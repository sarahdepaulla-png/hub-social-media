import { ConvexError, v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin, requireClientBySlug } from "./lib/access";
import { displayName } from "./lib/log";
import { saveRevision } from "./lib/revisions";

/** Versões guardadas de um briefing, peça (ficha e legendas) ou plano, da mais nova para a mais antiga. */
export const list = query({
  args: { targetId: v.string() },
  handler: async (ctx, { targetId }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("revisions")
      .withIndex("by_target", (q) => q.eq("targetId", targetId))
      .order("desc")
      .take(60);
    return await Promise.all(
      rows.map(async (r) => ({
        _id: r._id,
        at: r._creationTime,
        kind: r.kind,
        reason: r.reason,
        label: r.label,
        who: r.userId ? displayName(await ctx.db.get(r.userId)) : "Sistema",
        preview: preview(r.kind, r.data),
      })),
    );
  },
});

/** Resumo legível do que estava salvo naquela versão. */
function preview(kind: Doc<"revisions">["kind"], data: Record<string, unknown> | Record<string, unknown>[]): string {
  if (kind === "legendas" && Array.isArray(data)) {
    const first = (data[0]?.text as string | undefined) ?? "";
    return `${data.length} ${data.length === 1 ? "opção" : "opções"}: "${first.slice(0, 90)}${first.length > 90 ? "…" : ""}"`;
  }
  const d = data as Record<string, unknown>;
  if (kind === "briefing") return `${d.title ?? ""}. ${String(d.body ?? "").slice(0, 110)}`;
  if (kind === "plano") return String(d.theme ?? "");
  return [d.date, d.title, d.format].filter(Boolean).join(" · ");
}

/** Briefings apagados de uma cliente (dá para trazer de volta). */
export const deletedBriefings = query({
  args: { slug: v.optional(v.string()) },
  handler: async (ctx, { slug }) => {
    await requireAdmin(ctx);
    const clientId = slug ? (await requireClientBySlug(ctx, slug)).client._id : undefined;
    const rows = clientId
      ? await ctx.db
          .query("revisions")
          .withIndex("by_client_kind", (q) => q.eq("clientId", clientId).eq("kind", "briefing"))
          .order("desc")
          .take(200)
      : (await ctx.db.query("revisions").order("desc").take(800)).filter((r) => r.kind === "briefing");
    const out = [];
    const seen = new Set<string>();
    for (const r of rows) {
      if (r.reason !== "Antes de apagar" || seen.has(r.targetId)) continue;
      seen.add(r.targetId);
      if (await ctx.db.get(r.targetId as Id<"briefings">)) continue; // já foi restaurado
      const client = await ctx.db.get(r.clientId);
      out.push({ _id: r._id, at: r._creationTime, label: r.label, client: client?.name ?? "", slug: client?.slug ?? "", who: r.userId ? displayName(await ctx.db.get(r.userId)) : "Sistema" });
    }
    return out;
  },
});

const CONTENT_FIELDS = ["date", "time", "title", "platform", "format", "objective", "pillar", "externalUrl", "owner", "dueDate"] as const;
const BRIEF_FIELDS = ["title", "platform", "format", "desiredDate", "dueDate", "owner", "objective", "body", "links"] as const;
const PLAN_FIELDS = ["theme", "concept", "mood", "palette", "moodPhrases", "goals", "phases", "highlight", "needs", "pieces"] as const;

function pick(data: Record<string, unknown>, keys: readonly string[]) {
  return Object.fromEntries(keys.map((k) => [k, data[k] === null ? undefined : data[k]]));
}

/** Volta para uma versão. Antes, guarda como está agora (dá para desfazer a restauração). */
export const restore = mutation({
  args: { revisionId: v.id("revisions") },
  handler: async (ctx, { revisionId }) => {
    await requireAdmin(ctx);
    const r = await ctx.db.get(revisionId);
    if (!r) throw new ConvexError("Versão não encontrada.");
    const data = r.data as Record<string, unknown>;

    if (r.kind === "briefing") {
      const id = r.targetId as Id<"briefings">;
      const now = await ctx.db.get(id);
      if (now) {
        await saveRevision(ctx, { clientId: r.clientId, kind: "briefing", targetId: id, label: now.title, reason: "Antes de restaurar", data: now });
        await ctx.db.patch(id, pick(data, BRIEF_FIELDS));
        return { briefingId: id };
      }
      // Briefing apagado: volta como novo, na fila do estúdio.
      const content = data.contentId ? await ctx.db.get(data.contentId as Id<"contents">) : null;
      const newId = await ctx.db.insert("briefings", {
        ...(pick(data, BRIEF_FIELDS) as Pick<Doc<"briefings">, (typeof BRIEF_FIELDS)[number]>),
        clientId: r.clientId,
        authorId: data.authorId as Id<"users">,
        status: content && !content.deletedAt ? "em_criacao" : "novo",
        contentId: content && !content.deletedAt ? content._id : undefined,
      });
      if (content && !content.deletedAt && !content.briefingId) await ctx.db.patch(content._id, { briefingId: newId });
      // A versão apagada passa a apontar para o novo, para não aparecer de novo na lista de apagados.
      await ctx.db.patch(revisionId, { targetId: newId });
      return { briefingId: newId };
    }

    if (r.kind === "conteudo") {
      const id = r.targetId as Id<"contents">;
      const now = await ctx.db.get(id);
      if (!now) throw new ConvexError("Essa peça foi apagada de vez. A cópia está no backup diário.");
      await saveRevision(ctx, { clientId: r.clientId, kind: "conteudo", targetId: id, label: now.title, reason: "Antes de restaurar", data: now });
      await ctx.db.patch(id, pick(data, CONTENT_FIELDS));
      return { contentId: id };
    }

    if (r.kind === "legendas") {
      const id = r.targetId as Id<"contents">;
      const now = await ctx.db.get(id);
      if (!now) throw new ConvexError("Essa peça foi apagada de vez.");
      const current = await ctx.db.query("captions").withIndex("by_content", (q) => q.eq("contentId", id)).collect();
      await saveRevision(ctx, { clientId: r.clientId, kind: "legendas", targetId: id, label: now.title, reason: "Antes de restaurar", data: current });
      for (const c of current) await ctx.db.delete(c._id);
      for (const c of r.data as Doc<"captions">[]) {
        await ctx.db.insert("captions", { contentId: id, order: c.order, text: c.text, cta: c.cta, hashtags: c.hashtags, notes: c.notes, chosenBy: c.chosenBy, chosenAt: c.chosenAt });
      }
      return { contentId: id };
    }

    const id = r.targetId as Id<"monthPlans">;
    const now = await ctx.db.get(id);
    if (!now) throw new ConvexError("Esse plano não existe mais.");
    await saveRevision(ctx, { clientId: r.clientId, kind: "plano", targetId: id, label: now.theme, reason: "Antes de restaurar", data: now });
    await ctx.db.patch(id, { ...pick(data, PLAN_FIELDS), updatedAt: Date.now() });
    return { planId: id };
  },
});

/* ---------- Backup diário ---------- */

const TABLES = ["clients", "contents", "captions", "briefings", "monthPlans", "ideas", "pautas", "comments", "decisions", "media", "feedPosts", "profileItems", "opportunities", "invites"] as const;

export const dump = internalQuery({
  args: {},
  handler: async (ctx) => {
    const out: Record<string, unknown[]> = {};
    for (const t of TABLES) out[t] = await ctx.db.query(t).collect();
    return out;
  },
});

export const recordBackup = internalMutation({
  args: { storageId: v.id("_storage"), counts: v.any(), bytes: v.number() },
  handler: async (ctx, a) => {
    await ctx.db.insert("backups", a);
    // Guarda os últimos 30 dias.
    const all = await ctx.db.query("backups").order("desc").collect();
    for (const old of all.slice(30)) {
      await ctx.storage.delete(old.storageId);
      await ctx.db.delete(old._id);
    }
    // Versões com mais de 180 dias saem (o backup diário cobre o resto).
    const limit = Date.now() - 180 * 86_400_000;
    for (const r of await ctx.db.query("revisions").withIndex("by_creation_time", (q) => q.lt("_creationTime", limit)).take(500)) {
      await ctx.db.delete(r._id);
    }
  },
});

export const runBackup = internalAction({
  args: {},
  handler: async (ctx) => {
    const data = await ctx.runQuery(internal.revisions.dump, {});
    const json = JSON.stringify({ at: new Date().toISOString(), data });
    const storageId = await ctx.storage.store(new Blob([json], { type: "application/json" }));
    const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, (v as unknown[]).length]));
    await ctx.runMutation(internal.revisions.recordBackup, { storageId, counts, bytes: json.length });
  },
});

export const backups = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("backups").order("desc").take(30);
    return await Promise.all(rows.map(async (b) => ({ _id: b._id, at: b._creationTime, bytes: b.bytes, counts: b.counts as Record<string, number>, url: await ctx.storage.getUrl(b.storageId) })));
  },
});

/** "Fazer backup agora". */
export const backupNow = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    await ctx.scheduler.runAfter(0, internal.revisions.runBackup, {});
  },
});
