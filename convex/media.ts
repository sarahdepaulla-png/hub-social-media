import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { canEditContent, getViewer, requireContentEditor, requireViewer } from "./lib/access";
import { logActivity } from "./lib/log";

/** URL temporária para o navegador subir um arquivo direto no storage. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const client = viewer.clientId ? await ctx.db.get(viewer.clientId) : null;
    if (viewer.role !== "admin" && !(client && canEditContent(viewer, client))) throw new ConvexError("Só a administradora pode fazer isso.");
    return await ctx.storage.generateUploadUrl();
  },
});

async function currentMedia(ctx: QueryCtx, content: Doc<"contents">) {
  const list = await ctx.db
    .query("media")
    .withIndex("by_content_version", (q) => q.eq("contentId", content._id).eq("version", content.version))
    .collect();
  return list.sort((a, b) => a.order - b.order);
}

/**
 * Capa da peça. Ordem de prioridade:
 * 1. capa enviada à mão (manual) nunca é trocada sozinha;
 * 2. primeira imagem da versão atual;
 * 3. quadro tirado do vídeo (gerado no navegador da admin).
 */
async function refreshCover(ctx: MutationCtx, content: Doc<"contents">) {
  const fresh = (await ctx.db.get(content._id))!;
  if (fresh.coverSource === "manual") return;
  const list = await currentMedia(ctx, fresh);
  const firstImage = list.find((m) => m.kind === "imagem" && m.storageId);
  if (firstImage) {
    if (fresh.coverSource === "quadro" && fresh.coverId) await ctx.storage.delete(fresh.coverId);
    await ctx.db.patch(fresh._id, { coverId: firstImage.storageId, coverSource: "imagem", coverUrl: undefined });
    return;
  }
  // Sem imagem: mantém um quadro de vídeo já gerado, se ainda houver vídeo.
  const hasVideo = list.some((m) => m.kind === "video");
  if (fresh.coverSource === "quadro" && hasVideo) return;
  if (fresh.coverSource === "quadro" && fresh.coverId) await ctx.storage.delete(fresh.coverId);
  await ctx.db.patch(fresh._id, { coverId: undefined, coverSource: undefined });
}

/** Define a capa: "manual" (a admin escolheu) ou "quadro" (gerada do vídeo). */
export const setCover = mutation({
  args: { contentId: v.id("contents"), storageId: v.id("_storage"), source: v.union(v.literal("manual"), v.literal("quadro")) },
  handler: async (ctx, { contentId, storageId, source }) => {
    const { viewer: admin, content } = await requireContentEditor(ctx, contentId);
    // Quadro automático não passa por cima de imagem nem de capa manual.
    if (source === "quadro" && (content.coverSource === "imagem" || content.coverSource === "manual")) {
      await ctx.storage.delete(storageId);
      return;
    }
    if (content.coverId && (content.coverSource === "manual" || content.coverSource === "quadro")) {
      await ctx.storage.delete(content.coverId);
    }
    await ctx.db.patch(contentId, { coverId: storageId, coverSource: source, coverUrl: undefined });
    if (source === "manual") {
      await logActivity(ctx, { clientId: content.clientId, contentId, userId: admin._id, kind: "midia", summary: "Trocou a capa" });
    }
  },
});

/** Volta para a capa automática (primeira imagem ou quadro do vídeo). */
export const resetCover = mutation({
  args: { contentId: v.id("contents") },
  handler: async (ctx, { contentId }) => {
    const { content } = await requireContentEditor(ctx, contentId);
    if (content.coverSource !== "manual") return;
    if (content.coverId) await ctx.storage.delete(content.coverId);
    await ctx.db.patch(contentId, { coverId: undefined, coverSource: undefined });
    await refreshCover(ctx, { ...content, coverId: undefined, coverSource: undefined });
  },
});

/** Peças com vídeo e sem capa: o navegador da admin gera o quadro. */
export const missingCovers = query({
  args: { contentId: v.optional(v.id("contents")) },
  handler: async (ctx, { contentId }) => {
    const viewer = await getViewer(ctx);
    if (viewer?.role !== "admin") return [];
    const contents = contentId
      ? [await ctx.db.get(contentId)].filter((c): c is Doc<"contents"> => !!c)
      : (await ctx.db.query("contents").collect()).filter((c) => !c.coverId && !c.deletedAt);
    const out: { contentId: Doc<"contents">["_id"]; videoUrl: string }[] = [];
    for (const c of contents) {
      if (c.coverId || out.length >= 12) continue;
      const video = (await currentMedia(ctx, c)).find((m) => m.kind === "video" && (m.storageId || m.url));
      if (!video) continue;
      const url = video.storageId ? await ctx.storage.getUrl(video.storageId) : video.url;
      if (url) out.push({ contentId: c._id, videoUrl: url });
    }
    return out;
  },
});

export const add = mutation({
  args: {
    contentId: v.id("contents"),
    kind: v.union(v.literal("imagem"), v.literal("video"), v.literal("link")),
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    alt: v.optional(v.string()),
  },
  handler: async (ctx, { contentId, kind, storageId, url, alt }) => {
    const { viewer: admin, content } = await requireContentEditor(ctx, contentId);
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
    const media = await ctx.db.get(mediaId);
    if (!media) return;
    const { viewer: admin, content } = await requireContentEditor(ctx, media.contentId);
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
    const media = await ctx.db.get(mediaId);
    if (!media) return;
    const { content } = await requireContentEditor(ctx, media.contentId);
    const list = await currentMedia(ctx, content);
    const i = list.findIndex((m) => m._id === mediaId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return;
    await ctx.db.patch(list[i]._id, { order: list[j].order });
    await ctx.db.patch(list[j]._id, { order: list[i].order });
    await refreshCover(ctx, content);
  },
});
