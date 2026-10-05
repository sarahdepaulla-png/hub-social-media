import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/access";
import { logActivity } from "./lib/log";

/** URL temporária para o navegador subir um arquivo direto no storage. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

async function currentMedia(ctx: MutationCtx, content: Doc<"contents">) {
  const list = await ctx.db
    .query("media")
    .withIndex("by_content_version", (q) => q.eq("contentId", content._id).eq("version", content.version))
    .collect();
  return list.sort((a, b) => a.order - b.order);
}

/** A capa é sempre a primeira imagem da versão atual. */
async function refreshCover(ctx: MutationCtx, content: Doc<"contents">) {
  const list = await currentMedia(ctx, content);
  const first = list.find((m) => m.kind === "imagem" && m.storageId);
  await ctx.db.patch(content._id, { coverId: first?.storageId, coverUrl: first ? undefined : content.coverUrl });
}

async function loadContent(ctx: MutationCtx, contentId: Id<"contents">) {
  const content = await ctx.db.get(contentId);
  if (!content) throw new ConvexError("Conteúdo não encontrado.");
  return content;
}

export const add = mutation({
  args: {
    contentId: v.id("contents"),
    kind: v.union(v.literal("imagem"), v.literal("video"), v.literal("link")),
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    alt: v.optional(v.string()),
  },
  handler: async (ctx, { contentId, kind, storageId, url, alt }) => {
    const admin = await requireAdmin(ctx);
    const content = await loadContent(ctx, contentId);
    if (!storageId && !url) throw new ConvexError("Envie um arquivo ou cole um link.");
    const list = await currentMedia(ctx, content);
    const order = (list.at(-1)?.order ?? 0) + 1;
    await ctx.db.insert("media", { contentId, version: content.version, order, kind, storageId, url, alt });
    await refreshCover(ctx, content);
    await logActivity(ctx, {
      clientId: content.clientId,
      contentId,
      userId: admin._id,
      kind: "midia",
      summary: `Adicionou ${kind === "video" ? "vídeo" : kind === "link" ? "link" : "imagem"} na versão ${content.version}`,
    });
  },
});

export const remove = mutation({
  args: { mediaId: v.id("media") },
  handler: async (ctx, { mediaId }) => {
    const admin = await requireAdmin(ctx);
    const media = await ctx.db.get(mediaId);
    if (!media) return;
    const content = await loadContent(ctx, media.contentId);
    if (media.version !== content.version) throw new ConvexError("Versões antigas ficam guardadas e não podem ser editadas.");
    await ctx.db.delete(mediaId);
    // O mesmo arquivo pode estar em versões antigas (copiado). Só apaga se ninguém mais usa.
    if (media.storageId) {
      const all = await ctx.db
        .query("media")
        .withIndex("by_content_version", (q) => q.eq("contentId", media.contentId))
        .collect();
      if (!all.some((m) => m.storageId === media.storageId)) await ctx.storage.delete(media.storageId);
    }
    const rest = await currentMedia(ctx, content);
    for (const [i, m] of rest.entries()) if (m.order !== i + 1) await ctx.db.patch(m._id, { order: i + 1 });
    await refreshCover(ctx, content);
    await logActivity(ctx, {
      clientId: content.clientId,
      contentId: content._id,
      userId: admin._id,
      kind: "midia",
      summary: `Removeu o card ${media.order} da versão ${content.version}`,
    });
  },
});

/** Muda a ordem dos cards: -1 sobe, +1 desce. */
export const move = mutation({
  args: { mediaId: v.id("media"), direction: v.union(v.literal(-1), v.literal(1)) },
  handler: async (ctx, { mediaId, direction }) => {
    await requireAdmin(ctx);
    const media = await ctx.db.get(mediaId);
    if (!media) return;
    const content = await loadContent(ctx, media.contentId);
    const list = await currentMedia(ctx, content);
    const i = list.findIndex((m) => m._id === mediaId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return;
    await ctx.db.patch(list[i]._id, { order: list[j].order });
    await ctx.db.patch(list[j]._id, { order: list[i].order });
    await refreshCover(ctx, content);
  },
});
