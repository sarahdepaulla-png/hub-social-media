import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { format, platform } from "./schema";

/**
 * Fila de conteúdo: cada arquivo em conteudo/*.json vira peças no Hub
 * a cada publicação. Roda pelo build da Vercel (scripts/vercel-build.mjs).
 *
 * Idempotente pela chave `key`: rodar de novo atualiza a mesma peça,
 * nunca duplica. Peças que a cliente já decidiu (aprovado, agendado,
 * publicado) não são alteradas.
 */

const caption = v.object({
  text: v.string(),
  cta: v.optional(v.string()),
  hashtags: v.optional(v.string()),
  notes: v.optional(v.string()),
});

const item = v.object({
  key: v.string(),
  client: v.string(), // slug: lili, vivi, entalpia, bia
  date: v.string(), // AAAA-MM-DD
  time: v.optional(v.string()),
  platform,
  format,
  title: v.string(),
  objective: v.optional(v.string()),
  pillar: v.optional(v.string()),
  externalUrl: v.optional(v.string()),
  captions: v.optional(v.array(caption)),
  remove: v.optional(v.boolean()),
});

const LOCKED: Doc<"contents">["status"][] = ["aprovado", "agendado", "publicado"];

export const apply = internalMutation({
  args: { items: v.array(item) },
  handler: async (ctx, { items }) => {
    const admin = (await ctx.db.query("users").collect()).find((u) => u.role === "admin") ?? null;
    const log = async (clientId: Id<"clients">, contentId: Id<"contents">, summary: string) => {
      if (admin) await ctx.db.insert("activity", { clientId, contentId, userId: admin._id, kind: "edicao", summary });
    };
    const report: string[] = [];

    for (const it of items) {
      const client = await ctx.db
        .query("clients")
        .withIndex("by_slug", (q) => q.eq("slug", it.client))
        .unique();
      if (!client) {
        report.push(`${it.key}: cliente "${it.client}" não existe, pulei`);
        continue;
      }
      const existing = await ctx.db
        .query("contents")
        .withIndex("by_import_key", (q) => q.eq("importKey", it.key))
        .unique();

      if (it.remove) {
        if (existing && !LOCKED.includes(existing.status)) {
          for (const c of await ctx.db.query("captions").withIndex("by_content", (q) => q.eq("contentId", existing._id)).collect()) {
            await ctx.db.delete(c._id);
          }
          await ctx.db.delete(existing._id);
          report.push(`${it.key}: removida`);
        }
        continue;
      }

      const fields = {
        date: it.date,
        time: it.time,
        platform: it.platform,
        format: it.format,
        title: it.title,
        objective: it.objective,
        pillar: it.pillar,
        externalUrl: it.externalUrl,
      };

      let contentId: Id<"contents">;
      if (!existing) {
        contentId = await ctx.db.insert("contents", {
          clientId: client._id,
          status: "producao",
          version: 1,
          importKey: it.key,
          ...fields,
        });
        await log(client._id, contentId, "Criou o conteúdo pelo planejamento");
        report.push(`${it.key}: criada`);
      } else if (LOCKED.includes(existing.status)) {
        report.push(`${it.key}: já decidida pela cliente, não alterei`);
        continue;
      } else {
        contentId = existing._id;
        const changed = Object.entries(fields).some(([k, val]) => existing[k as keyof typeof existing] !== val);
        if (changed) {
          await ctx.db.patch(contentId, fields);
          await log(client._id, contentId, "Atualizou a ficha pelo planejamento");
          report.push(`${it.key}: atualizada`);
        }
      }

      if (it.captions) {
        const current = await ctx.db
          .query("captions")
          .withIndex("by_content", (q) => q.eq("contentId", contentId))
          .collect();
        const byOrder = new Map(current.map((c) => [c.order, c]));
        let touched = false;
        for (const [i, cap] of it.captions.entries()) {
          const order = i + 1;
          const fieldsCap = { order, text: cap.text, cta: cap.cta, hashtags: cap.hashtags, notes: cap.notes };
          const old = byOrder.get(order);
          if (!old) {
            await ctx.db.insert("captions", { contentId, ...fieldsCap });
            touched = true;
          } else if (old.text !== cap.text || old.cta !== cap.cta || old.hashtags !== cap.hashtags || old.notes !== cap.notes) {
            await ctx.db.patch(old._id, fieldsCap); // mantém a escolha da cliente
            touched = true;
          }
        }
        for (const old of current.filter((c) => c.order > it.captions!.length)) {
          await ctx.db.delete(old._id);
          touched = true;
        }
        if (touched && existing) await log(client._id, contentId, "Atualizou as legendas pelo planejamento");
      }
    }
    return report.length ? report.join("\n") : "Nada mudou";
  },
});
