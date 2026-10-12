import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin, requireClientBySlug } from "./lib/access";
import { alive } from "./lib/content";

/**
 * Prévia do feed: as peças planejadas (mais novas em cima) seguidas dos prints
 * dos posts que já estão no perfil. Stories não entram, como no Instagram.
 */
export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { viewer, client } = await requireClientBySlug(ctx, slug);
    const all = (
      await ctx.db
        .query("contents")
        .withIndex("by_client_date", (q) => q.eq("clientId", client._id))
        .collect()
    ).filter(alive);
    const planned = all
      .filter((c) => c.format !== "stories" && c.status !== "ideia")
      .sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? "").localeCompare(a.time ?? "") || b._creationTime - a._creationTime);
    const pieces = await Promise.all(
      planned.map(async (c) => ({
        _id: c._id,
        title: c.title,
        date: c.date,
        format: c.format,
        status: c.status,
        coverUrl: c.coverId ? await ctx.storage.getUrl(c.coverId) : (c.coverUrl ?? null),
      })),
    );
    const rows = await ctx.db
      .query("feedPosts")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .collect();
    const posts = await Promise.all(
      rows
        .sort((a, b) => a.position - b.position)
        .map(async (p) => ({ _id: p._id, kind: p.kind ?? "post", url: await ctx.storage.getUrl(p.storageId) })),
    );
    return {
      client: {
        name: client.name,
        handle: client.instagram ?? client.slug,
        description: client.description ?? null,
        accentColor: client.accentColor,
        photoUrl: client.photoId ? await ctx.storage.getUrl(client.photoId) : null,
      },
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

/** Prints do perfil atual, na ordem escolhida: o primeiro é o mais recente. Entram depois dos que já estão. */
export const addPosts = mutation({
  args: { slug: v.string(), storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, { slug, storageIds }) => {
    await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, slug);
    const current = await ordered(ctx, client._id);
    if (current.length + storageIds.length > 60) throw new ConvexError("Até 60 posts na prévia. Tire alguns antigos antes.");
    let position = current.length;
    for (const storageId of storageIds) {
      position++;
      await ctx.db.insert("feedPosts", { clientId: client._id, storageId, position });
    }
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
  args: { postId: v.id("feedPosts"), kind: v.union(v.literal("post"), v.literal("carrossel"), v.literal("reels")) },
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
    await ctx.storage.delete(post.storageId);
    await renumber(ctx, (await ordered(ctx, post.clientId)).map((p) => p._id));
  },
});

export const setHandle = mutation({
  args: { slug: v.string(), handle: v.string() },
  handler: async (ctx, { slug, handle }) => {
    await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, slug);
    const h = handle.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
    if (h && !/^[A-Za-z0-9._]{1,30}$/.test(h)) throw new ConvexError("Esse @ não parece do Instagram.");
    await ctx.db.patch(client._id, { instagram: h || undefined });
  },
});
