import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin, requireClientBySlug } from "./lib/access";
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
