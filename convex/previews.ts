import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { downloadImage, findPreview } from "./lib/fetchPreview";

/**
 * Busca a imagem de prévia de um link de referência e guarda no storage
 * (as imagens do Instagram e do TikTok expiram, por isso a cópia).
 * Roda em segundo plano logo depois que a referência é salva.
 */

export const getLink = internalQuery({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => (await ctx.db.get(ideaId))?.link ?? null,
});

export const save = internalMutation({
  args: {
    ideaId: v.id("ideas"),
    previewId: v.optional(v.id("_storage")),
    previewTitle: v.optional(v.string()),
    failed: v.boolean(),
  },
  handler: async (ctx, { ideaId, previewId, previewTitle, failed }) => {
    const idea = await ctx.db.get(ideaId);
    if (!idea) {
      if (previewId) await ctx.storage.delete(previewId);
      return;
    }
    if (idea.previewId && previewId) await ctx.storage.delete(idea.previewId);
    await ctx.db.patch(ideaId, {
      previewId: previewId ?? idea.previewId,
      previewTitle: previewTitle ?? idea.previewTitle,
      previewStatus: failed && !previewId ? "falhou" : "ok",
    });
  },
});

export const fetchFor = internalAction({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const link = await ctx.runQuery(internal.previews.getLink, { ideaId });
    if (!link) return;
    try {
      const { image, title } = await findPreview(link);
      let previewId = undefined;
      if (image) {
        const blob = await downloadImage(image);
        if (blob) previewId = await ctx.storage.store(blob);
      }
      await ctx.runMutation(internal.previews.save, {
        ideaId,
        previewId,
        previewTitle: title ?? undefined,
        failed: !previewId,
      });
    } catch {
      await ctx.runMutation(internal.previews.save, { ideaId, failed: true });
    }
  },
});
