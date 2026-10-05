import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { parsePreview, platformOf, youtubeId } from "./lib/preview";

/**
 * Busca a imagem de prévia de um link de referência e guarda no storage
 * (as imagens do Instagram e do TikTok expiram, por isso a cópia).
 * Roda em segundo plano logo depois que a referência é salva.
 */

const UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const MAX_IMAGE = 8 * 1024 * 1024;

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

async function fetchText(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/json", "Accept-Language": "pt-BR,pt;q=0.9" },
    redirect: "follow",
  });
  if (!res.ok) return null;
  return (await res.text()).slice(0, 800_000);
}

async function findPreview(link: string): Promise<{ image: string | null; title: string | null }> {
  const platform = platformOf(link);

  if (platform === "youtube") {
    const id = youtubeId(link);
    let title: string | null = null;
    try {
      const o = await fetchText(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link)}`);
      if (o) title = (JSON.parse(o) as { title?: string }).title ?? null;
    } catch {
      /* sem título */
    }
    return { image: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null, title };
  }

  if (platform === "tiktok") {
    try {
      const o = await fetchText(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link)}`);
      if (o) {
        const j = JSON.parse(o) as { thumbnail_url?: string; title?: string };
        if (j.thumbnail_url) return { image: j.thumbnail_url, title: j.title ?? null };
      }
    } catch {
      /* tenta a página */
    }
  }

  const html = await fetchText(link);
  return html ? parsePreview(html, link) : { image: null, title: null };
}

export const fetchFor = internalAction({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const link = await ctx.runQuery(internal.previews.getLink, { ideaId });
    if (!link) return;
    try {
      const { image, title } = await findPreview(link);
      let previewId = undefined;
      if (image) {
        const res = await fetch(image, { headers: { "User-Agent": UA } });
        const type = res.headers.get("content-type") ?? "";
        if (res.ok && type.startsWith("image/")) {
          const blob = await res.blob();
          if (blob.size > 0 && blob.size <= MAX_IMAGE) previewId = await ctx.storage.store(blob);
        }
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
