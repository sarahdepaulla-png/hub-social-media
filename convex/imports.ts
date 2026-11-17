import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { format, platform } from "./schema";

/**
 * Fila de conteúdo: cada arquivo em conteudo/*.json vira peças no Hub
 * a cada publicação. Roda pelo build da Vercel (scripts/vercel-build.mjs).
 *
 * Idempotente pela chave `key`: nunca duplica.
 * REGRA: a fila só CRIA. Depois que a peça existe, quem manda é o Hub: data, tema,
 * legendas e o resto não são mais tocados pela fila (senão cada publicação do site
 * desfaz o que a equipe mudou). Para mudar uma peça pela fila de propósito, use "force": true.
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
  // Só na criação: "ideia" para peças que ainda são só a ideia do plano do mês.
  status: v.optional(v.union(v.literal("ideia"), v.literal("producao"))),
  // Só com isso a fila mexe numa peça que já existe.
  force: v.optional(v.boolean()),
});

const FIELDS = ["date", "time", "platform", "format", "title", "objective", "pillar", "externalUrl"] as const;

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

      const buried = await ctx.db
        .query("importTombstones")
        .withIndex("by_key", (q) => q.eq("key", it.key))
        .first();
      if (buried && !existing) {
        report.push(`${it.key}: apagada pela admin, não recriei`);
        continue;
      }
      if (existing?.deletedAt) {
        report.push(`${it.key}: está na lixeira, não mexi`);
        continue;
      }

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
          status: it.status ?? "producao",
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
        if (it.force) {
          const changed = Object.entries(fields).some(([k, val]) => existing[k as keyof typeof existing] !== val);
          if (changed) {
            await ctx.db.patch(contentId, fields);
            await log(client._id, contentId, "Atualizou a ficha pelo planejamento");
            report.push(`${it.key}: atualizada (force)`);
          }
        } else {
          const back = await recoverOverwritten(ctx, existing, fields);
          if (back) report.push(`${it.key}: ${back}`);
        }
        // Ideia que já pode ir direto para o calendário: a fila manda "producao".
        if (existing.status === "ideia" && it.status === "producao") {
          await ctx.db.patch(contentId, { status: "producao" });
          await log(client._id, contentId, "Entrou no calendário pelo planejamento");
          report.push(`${it.key}: foi para o calendário`);
        }
        if (!it.force) continue; // legendas também são do Hub
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

/**
 * Conserto: antes da regra "a fila só cria", cada publicação do site voltava a ficha para
 * o que estava no arquivo, por cima do que a equipe tinha mudado no Hub. Aqui o que a
 * pessoa mudou volta, campo a campo: só quando o valor de agora é o do arquivo e a fila
 * passou por cima depois da edição. Guarda versão antes e registra no histórico.
 */
async function recoverOverwritten(ctx: MutationCtx, content: Doc<"contents">, file: Record<string, unknown>) {
  const acts = await ctx.db
    .query("activity")
    .withIndex("by_content", (q) => q.eq("contentId", content._id))
    .collect();
  const overwrites = acts.filter((a) => a.summary === "Atualizou a ficha pelo planejamento").map((a) => a._creationTime);
  if (overwrites.length === 0) return null;
  const lastOverwrite = Math.max(...overwrites);
  // Último valor escolhido por uma pessoa em cada campo.
  const human = new Map<string, { value: unknown; at: number; userId: Id<"users"> }>();
  for (const a of acts) {
    if (a.kind !== "edicao" || !a.after || typeof a.after !== "object") continue;
    for (const [k, val] of Object.entries(a.after as Record<string, unknown>)) {
      if (!(FIELDS as readonly string[]).includes(k)) continue;
      const prev = human.get(k);
      if (!prev || prev.at <= a._creationTime) human.set(k, { value: val, at: a._creationTime, userId: a.userId });
    }
  }
  const patch: Record<string, unknown> = {};
  let who: Id<"users"> | null = null;
  for (const [k, h] of human) {
    const now = content[k as keyof typeof content];
    if (h.at < lastOverwrite && now === file[k] && h.value !== now) {
      patch[k] = h.value;
      who = h.userId;
    }
  }
  if (!who) return null;
  await ctx.db.insert("revisions", {
    clientId: content.clientId,
    kind: "conteudo",
    targetId: content._id,
    label: content.title,
    reason: "Antes de recuperar a edição da equipe",
    data: content,
  });
  await ctx.db.patch(content._id, patch);
  const person = await ctx.db.get(who);
  const name = person?.name ?? person?.email?.split("@")[0] ?? "a equipe";
  const labels: Record<string, string> = { date: "data", time: "horário", title: "tema", format: "formato", platform: "plataforma", objective: "objetivo", pillar: "pilar", externalUrl: "link" };
  await ctx.db.insert("activity", {
    clientId: content.clientId,
    contentId: content._id,
    userId: who,
    kind: "edicao",
    summary: `Recuperou o que ${name} tinha mudado (${Object.keys(patch).map((k) => labels[k] ?? k).join(", ")}): o planejamento tinha passado por cima`,
  });
  return `recuperada a edição de ${name} (${Object.keys(patch).join(", ")})`;
}
