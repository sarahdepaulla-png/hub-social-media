import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireContentEditor } from "./lib/access";
import { logActivity } from "./lib/log";
import { saveRevision } from "./lib/revisions";

/**
 * Salva todas as opções de legenda de uma vez.
 * Mantém a escolha da cliente nas opções que continuam existindo.
 */
export const save = mutation({
  args: {
    contentId: v.id("contents"),
    items: v.array(
      v.object({
        _id: v.optional(v.id("captions")),
        text: v.string(),
        cta: v.optional(v.string()),
        hashtags: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { contentId, items }) => {
    const { viewer: admin, content } = await requireContentEditor(ctx, contentId);
    const existing = await ctx.db
      .query("captions")
      .withIndex("by_content", (q) => q.eq("contentId", contentId))
      .collect();

    if (existing.length) {
      await saveRevision(ctx, { clientId: content.clientId, kind: "legendas", targetId: contentId, label: content.title, reason: "Antes de salvar as legendas", data: existing });
    }
    const kept = new Set(items.map((i) => i._id).filter(Boolean));
    for (const c of existing) if (!kept.has(c._id)) await ctx.db.delete(c._id);

    const clean = (s?: string) => (s?.trim() ? s.trim() : undefined);
    let order = 0;
    const ids: (string | null)[] = [];
    for (const item of items) {
      if (!item.text.trim()) {
        ids.push(item._id ?? null);
        continue;
      }
      order++;
      const fields = { order, text: item.text.trim(), cta: clean(item.cta), hashtags: clean(item.hashtags), notes: clean(item.notes) };
      const current = item._id ? existing.find((c) => c._id === item._id) : undefined;
      if (current) {
        await ctx.db.patch(current._id, fields);
        ids.push(current._id);
      } else ids.push(await ctx.db.insert("captions", { contentId, ...fields }));
    }
    await logActivity(ctx, {
      clientId: content.clientId,
      contentId,
      userId: admin._id,
      kind: "legenda",
      summary: `Salvou ${order} ${order === 1 ? "opção" : "opções"} de legenda`,
    });
    // Mesma ordem das opções recebidas: o editor guarda o id das novas.
    return ids;
  },
});
