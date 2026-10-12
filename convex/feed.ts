import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getViewer, requireAdmin, requireClientBySlug } from "./lib/access";
import { alive } from "./lib/content";

/**
 * Prévia do feed, no jeito dos apps de grid: posts montados à mão (o "+" põe no topo)
 * e, se ligado, as peças do calendário em cima. Stories não entram, como no Instagram.
 */
const kindV = v.union(v.literal("post"), v.literal("carrossel"), v.literal("reels"));

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { viewer, client } = await requireClientBySlug(ctx, slug);
    const showPlanned = client.feedShowPlanned === true;
    let pieces: { _id: Id<"contents">; title: string; date: string; format: string; status: string; coverUrl: string | null }[] = [];
    if (showPlanned) {
      const all = (
        await ctx.db
          .query("contents")
          .withIndex("by_client_date", (q) => q.eq("clientId", client._id))
          .collect()
      ).filter(alive);
      pieces = await Promise.all(
        all
          .filter((c) => c.format !== "stories" && c.status !== "ideia" && c.status !== "publicado")
          .sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? "").localeCompare(a.time ?? "") || b._creationTime - a._creationTime)
          .map(async (c) => ({
            _id: c._id,
            title: c.title,
            date: c.date,
            format: c.format,
            status: c.status,
            coverUrl: c.coverId ? await ctx.storage.getUrl(c.coverId) : (c.coverUrl ?? null),
          })),
      );
    }
    const rows = await ctx.db
      .query("feedPosts")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .collect();
    const posts = await Promise.all(
      rows
        .sort((a, b) => a.position - b.position)
        .map(async (p) => ({
          _id: p._id,
          kind: p.kind ?? "post",
          isVideo: p.isVideo === true,
          url: await ctx.storage.getUrl(p.storageId),
          extras: await Promise.all((p.extraIds ?? []).map((id) => ctx.storage.getUrl(id))),
        })),
    );
    const prof = client.igProfile ?? {};
    return {
      profile: {
        handle: client.instagram ?? client.slug,
        name: prof.name ?? client.name,
        bio: prof.bio ?? client.description ?? "",
        link: prof.link ?? "",
        posts: prof.posts ?? "",
        followers: prof.followers ?? "",
        following: prof.following ?? "",
        accentColor: client.accentColor,
        photoUrl: client.photoId ? await ctx.storage.getUrl(client.photoId) : null,
      },
      clientId: client._id,
      showPlanned,
      pieces,
      posts,
      canManage: viewer.role === "admin",
    };
  },
});

async function ordered(ctx: MutationCtx, clientId: Id<"clients">) {
  return (await ctx.db.query("feedPosts").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect()).sort(
    (a, b) => a.position - b.position,
  );
}

async function renumber(ctx: MutationCtx, ids: Id<"feedPosts">[]) {
  for (const [i, id] of ids.entries()) await ctx.db.patch(id, { position: i + 1 });
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Acrescenta posts. "topo": entram no começo do feed (o próximo post).
 * "fim": entram no final (posts antigos que já estão no perfil).
 * Cada item é um post; carrossel tem mais de um arquivo.
 */
export const addPosts = mutation({
  args: {
    slug: v.string(),
    where: v.union(v.literal("topo"), v.literal("fim")),
    items: v.array(v.object({ storageIds: v.array(v.id("_storage")), isVideo: v.boolean() })),
  },
  handler: async (ctx, { slug, where, items }) => {
    await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, slug);
    const current = await ordered(ctx, client._id);
    if (current.length + items.length > 90) throw new ConvexError("Até 90 posts na prévia. Tire alguns antigos antes.");
    const created: Id<"feedPosts">[] = [];
    for (const it of items) {
      if (!it.storageIds.length) continue;
      const [first, ...rest] = it.storageIds;
      const kind = it.isVideo ? "reels" : rest.length ? "carrossel" : "post";
      created.push(
        await ctx.db.insert("feedPosts", {
          clientId: client._id,
          storageId: first,
          extraIds: rest.length ? rest : undefined,
          isVideo: it.isVideo || undefined,
          kind,
          position: 0,
        }),
      );
    }
    const ids = current.map((p) => p._id);
    await renumber(ctx, where === "topo" ? [...created, ...ids] : [...ids, ...created]);
  },
});

export const movePost = mutation({
  args: { postId: v.id("feedPosts"), direction: v.union(v.literal(-1), v.literal(1)) },
  handler: async (ctx, { postId, direction }) => {
    await requireAdmin(ctx);
    const post = await ctx.db.get(postId);
    if (!post) return;
    const list = await ordered(ctx, post.clientId);
    const i = list.findIndex((p) => p._id === postId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await renumber(ctx, list.map((p) => p._id));
  },
});

export const setKind = mutation({
  args: { postId: v.id("feedPosts"), kind: kindV },
  handler: async (ctx, { postId, kind }) => {
    await requireAdmin(ctx);
    if (await ctx.db.get(postId)) await ctx.db.patch(postId, { kind });
  },
});

export const removePost = mutation({
  args: { postId: v.id("feedPosts") },
  handler: async (ctx, { postId }) => {
    await requireAdmin(ctx);
    const post = await ctx.db.get(postId);
    if (!post) return;
    await ctx.db.delete(postId);
    for (const id of [post.storageId, ...(post.extraIds ?? [])]) await ctx.storage.delete(id);
    await renumber(ctx, (await ordered(ctx, post.clientId)).map((p) => p._id));
  },
});

const short = (s: string | undefined, max: number) => s?.trim().slice(0, max) || undefined;

/** "Editar perfil" da prévia: @, nome, bio, link e os números do topo. */
export const updateProfile = mutation({
  args: {
    slug: v.string(),
    handle: v.string(),
    name: v.string(),
    bio: v.string(),
    link: v.string(),
    posts: v.string(),
    followers: v.string(),
    following: v.string(),
  },
  handler: async (ctx, { slug, handle, ...p }) => {
    await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, slug);
    const h = handle.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?].*$/, "");
    if (h && !/^[A-Za-z0-9._]{1,30}$/.test(h)) throw new ConvexError("Esse @ não parece do Instagram.");
    await ctx.db.patch(client._id, {
      instagram: h || undefined,
      igProfile: {
        name: short(p.name, 60),
        bio: p.bio.trim().slice(0, 300) || undefined,
        link: short(p.link, 120),
        posts: short(p.posts, 12),
        followers: short(p.followers, 12),
        following: short(p.following, 12),
      },
    });
  },
});

/** Mostra (ou não) as peças do calendário no topo da prévia. */
export const setShowPlanned = mutation({
  args: { slug: v.string(), value: v.boolean() },
  handler: async (ctx, { slug, value }) => {
    await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, slug);
    await ctx.db.patch(client._id, { feedShowPlanned: value });
  },
});

/* ---------- Post a partir de um link ---------- */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

function decodeHtml(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&#47;/g, "/").replace(/&quot;/g, '"').replace(/\\u0026/g, "&").replace(/\\\//g, "/");
}

function metaImage(html: string) {
  const m =
    html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  return m ? decodeHtml(m[1]) : null;
}

async function getText(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" }, redirect: "follow" });
  if (!res.ok) throw new Error(`O site respondeu ${res.status}`);
  return await res.text();
}

/** Descobre a imagem de capa e o tipo do post a partir do link. */
async function coverFromLink(raw: string): Promise<{ image: string; kind: "post" | "reels" }> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new ConvexError("Esse link não parece válido.");
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  // Instagram: a página pública de incorporar o post traz a imagem sem login.
  if (host.endsWith("instagram.com")) {
    const m = url.pathname.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    if (!m) throw new ConvexError("Cole o link de um post ou reels do Instagram (com /p/ ou /reel/).");
    const kind = m[1] === "p" ? "post" : "reels";
    const html = await getText(`https://www.instagram.com/p/${m[2]}/embed/captioned/`).catch(() => "");
    const img =
      html.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/)?.[1] ??
      html.match(/<img[^>]+class="[^"]*EmbeddedMediaImage[^"]*"[^>]+src="([^"]+)"/)?.[1] ??
      html.match(/"display_url"\s*:\s*"([^"]+)"/)?.[1] ??
      metaImage(html);
    if (!img) throw new ConvexError("O Instagram não liberou a capa deste post. Copie a imagem e cole com Ctrl+V.");
    return { image: decodeHtml(img), kind };
  }
  // TikTok: oEmbed público.
  if (host.endsWith("tiktok.com")) {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url.toString())}`, { headers: { "User-Agent": UA } });
    const data = (await res.json().catch(() => null)) as { thumbnail_url?: string } | null;
    if (!data?.thumbnail_url) throw new ConvexError("O TikTok não liberou a capa deste vídeo.");
    return { image: data.thumbnail_url, kind: "reels" };
  }
  // YouTube: miniatura pública.
  const yt = host === "youtu.be" ? url.pathname.slice(1) : host.endsWith("youtube.com") ? (url.searchParams.get("v") ?? url.pathname.match(/\/(shorts|embed)\/([^/?]+)/)?.[2]) : null;
  if (yt) return { image: `https://img.youtube.com/vi/${yt}/hqdefault.jpg`, kind: "reels" };
  // Google Drive: miniatura do arquivo compartilhado.
  const drive = host.endsWith("drive.google.com") ? (url.pathname.match(/\/d\/([^/]+)/)?.[1] ?? url.searchParams.get("id")) : null;
  if (drive) return { image: `https://drive.google.com/thumbnail?id=${drive}&sz=w1080`, kind: "post" };
  // Link direto de imagem.
  if (/\.(jpe?g|png|webp|gif)$/i.test(url.pathname)) return { image: url.toString(), kind: "post" };
  // Qualquer outro site: imagem de prévia (Canva, Pinterest, Behance...).
  const html = await getText(url.toString()).catch(() => "");
  const og = metaImage(html);
  if (!og) throw new ConvexError("Não achei a imagem de capa desse link. Copie a imagem e cole com Ctrl+V.");
  return { image: new URL(og, url).toString(), kind: "post" };
}

/** Cola o link do post: o Hub baixa a capa e põe no topo do feed. */
export const addFromLink = action({
  args: { slug: v.string(), url: v.string() },
  handler: async (ctx, { slug, url }): Promise<{ kind: "post" | "reels" }> => {
    const viewer = await ctx.runQuery(internal.feed.viewerRole, {});
    if (viewer !== "admin") throw new ConvexError("Só a administradora pode fazer isso.");
    const { image, kind } = await coverFromLink(url);
    const res = await fetch(image, { headers: { "User-Agent": UA, Referer: "https://www.instagram.com/" } }).catch(() => null);
    const type = res?.headers.get("content-type") ?? "";
    if (!res?.ok || !type.startsWith("image/")) {
      throw new ConvexError("Achei o post, mas a imagem não baixou. Se for do Drive, deixe o arquivo como \"qualquer pessoa com o link\".");
    }
    const blob = await res.blob();
    if (blob.size > 15 * 1024 * 1024) throw new ConvexError("A imagem desse link é grande demais.");
    const storageId = await ctx.storage.store(blob);
    await ctx.runMutation(internal.feed.insertStored, { slug, storageId, kind });
    return { kind };
  },
});

export const viewerRole = internalQuery({
  args: {},
  handler: async (ctx) => (await getViewer(ctx))?.role ?? null,
});

export const insertStored = internalMutation({
  args: { slug: v.string(), storageId: v.id("_storage"), kind: kindV },
  handler: async (ctx, { slug, storageId, kind }) => {
    const client = await ctx.db
      .query("clients")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!client) throw new ConvexError("Cliente não encontrado.");
    const current = await ordered(ctx, client._id);
    const id = await ctx.db.insert("feedPosts", { clientId: client._id, storageId, kind, position: 0 });
    await renumber(ctx, [id, ...current.map((p) => p._id)]);
  },
});
