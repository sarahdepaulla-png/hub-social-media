import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { format, platform } from "./schema";
import { requireAdmin, requireClientAccess, requireClientBySlug } from "./lib/access";
import { displayName, logActivity } from "./lib/log";

/**
 * Banco de pautas: a cliente anota o que quer falar (tema, formato, mês,
 * como imagina, anexos). O estúdio vê, comenta e leva para o calendário.
 */

const MONTH = /^\d{4}-\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const fileV = v.object({ id: v.id("_storage"), name: v.string(), type: v.string() });

function cleanLink(link?: string) {
  const l = link?.trim();
  if (!l) return undefined;
  if (!/^https?:\/\/\S+$/i.test(l)) throw new ConvexError("O link precisa começar com https://");
  return l;
}

async function shape(ctx: QueryCtx, p: Doc<"pautas">, viewer: Doc<"users">) {
  const author = await ctx.db.get(p.authorId);
  const content = p.contentId ? await ctx.db.get(p.contentId) : null;
  const files = [];
  for (const f of p.files ?? []) files.push({ ...f, url: await ctx.storage.getUrl(f.id) });
  const admin = viewer.role === "admin";
  return {
    _id: p._id,
    title: p.title,
    format: p.format ?? null,
    month: p.month ?? null,
    notes: p.notes ?? null,
    link: p.link ?? null,
    files,
    status: p.status,
    studioNote: p.studioNote ?? null,
    at: p._creationTime,
    authorName: author?.role === "admin" ? "Estúdio" : displayName(author),
    authorIsStudio: author?.role === "admin",
    canEdit: admin || (p.authorId === viewer._id && p.status !== "calendario"),
    content: content && !content.deletedAt ? { _id: content._id, date: content.date, status: content.status } : null,
  };
}

async function load(ctx: QueryCtx, pautaId: Id<"pautas">) {
  const p = await ctx.db.get(pautaId);
  if (!p) throw new ConvexError("Pauta não encontrada.");
  const viewer = await requireClientAccess(ctx, p.clientId).catch(() => {
    throw new ConvexError("Pauta não encontrada.");
  });
  return { p, viewer };
}

function assertCanEdit(p: Doc<"pautas">, viewer: Doc<"users">) {
  if (viewer.role === "admin") return;
  if (p.authorId !== viewer._id) throw new ConvexError("Só quem criou a pauta pode mudar.");
  if (p.status === "calendario") throw new ConvexError("Esta pauta já está no calendário. Comente na peça.");
}

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { viewer, client } = await requireClientBySlug(ctx, slug);
    const rows = await ctx.db
      .query("pautas")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .order("desc")
      .collect();
    return await Promise.all(rows.map((p) => shape(ctx, p, viewer)));
  },
});

export const create = mutation({
  args: {
    slug: v.string(),
    title: v.string(),
    format: v.optional(format),
    month: v.optional(v.string()),
    notes: v.optional(v.string()),
    link: v.optional(v.string()),
    files: v.optional(v.array(fileV)),
  },
  handler: async (ctx, { slug, ...f }) => {
    const { viewer, client } = await requireClientBySlug(ctx, slug);
    const title = f.title.trim();
    if (!title) throw new ConvexError("Escreva o tema da pauta.");
    if (f.month && !MONTH.test(f.month)) throw new ConvexError("Mês inválido.");
    const id = await ctx.db.insert("pautas", {
      clientId: client._id,
      authorId: viewer._id,
      title: title.slice(0, 200),
      format: f.format,
      month: f.month || undefined,
      notes: f.notes?.trim() || undefined,
      link: cleanLink(f.link),
      files: (f.files ?? []).slice(0, 12),
      // O que a admin cria já nasce "vista"; o que a cliente cria avisa o estúdio.
      status: viewer.role === "admin" ? "vista" : "nova",
    });
    await logActivity(ctx, { clientId: client._id, userId: viewer._id, kind: "ideia", summary: `Nova pauta: "${title}"` });
    return id;
  },
});

export const update = mutation({
  args: {
    pautaId: v.id("pautas"),
    title: v.optional(v.string()),
    format: v.optional(v.union(format, v.null())),
    month: v.optional(v.union(v.string(), v.null())),
    notes: v.optional(v.string()),
    link: v.optional(v.string()),
  },
  handler: async (ctx, { pautaId, ...f }) => {
    const { p, viewer } = await load(ctx, pautaId);
    assertCanEdit(p, viewer);
    const patch: Partial<Doc<"pautas">> = {};
    if (f.title !== undefined) {
      const t = f.title.trim();
      if (!t) throw new ConvexError("O tema não pode ficar vazio.");
      patch.title = t.slice(0, 200);
    }
    if (f.format !== undefined) patch.format = f.format ?? undefined;
    if (f.month !== undefined) {
      if (f.month && !MONTH.test(f.month)) throw new ConvexError("Mês inválido.");
      patch.month = f.month || undefined;
    }
    if (f.notes !== undefined) patch.notes = f.notes.trim() || undefined;
    if (f.link !== undefined) patch.link = cleanLink(f.link);
    await ctx.db.patch(pautaId, patch);
  },
});

export const addFiles = mutation({
  args: { pautaId: v.id("pautas"), files: v.array(fileV) },
  handler: async (ctx, { pautaId, files }) => {
    const { p, viewer } = await load(ctx, pautaId);
    assertCanEdit(p, viewer);
    const all = [...(p.files ?? []), ...files];
    if (all.length > 12) throw new ConvexError("Até 12 anexos por pauta.");
    await ctx.db.patch(pautaId, { files: all });
  },
});

export const removeFile = mutation({
  args: { pautaId: v.id("pautas"), fileId: v.id("_storage") },
  handler: async (ctx, { pautaId, fileId }) => {
    const { p, viewer } = await load(ctx, pautaId);
    assertCanEdit(p, viewer);
    await ctx.db.patch(pautaId, { files: (p.files ?? []).filter((f) => f.id !== fileId) });
    await ctx.storage.delete(fileId);
  },
});

/** Estúdio: marcar como vista, guardar para depois ou trazer de volta. */
export const setStatus = mutation({
  args: { pautaId: v.id("pautas"), status: v.union(v.literal("vista"), v.literal("guardada"), v.literal("nova")) },
  handler: async (ctx, { pautaId, status }) => {
    await requireAdmin(ctx);
    const p = await ctx.db.get(pautaId);
    if (!p) throw new ConvexError("Pauta não encontrada.");
    if (p.status === "calendario") return;
    await ctx.db.patch(pautaId, { status });
  },
});

/** Quando a admin abre o banco da cliente, as novas viram "vistas". */
export const markSeen = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { viewer, client } = await requireClientBySlug(ctx, slug);
    if (viewer.role !== "admin") return;
    const rows = await ctx.db
      .query("pautas")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .collect();
    for (const p of rows.filter((p) => p.status === "nova")) await ctx.db.patch(p._id, { status: "vista" });
  },
});

export const setNote = mutation({
  args: { pautaId: v.id("pautas"), note: v.string() },
  handler: async (ctx, { pautaId, note }) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(pautaId))) throw new ConvexError("Pauta não encontrada.");
    await ctx.db.patch(pautaId, { studioNote: note.trim().slice(0, 1000) || undefined });
  },
});

/** Leva a pauta para o calendário: cria a peça em produção com um briefing anexado. */
export const toCalendar = mutation({
  args: { pautaId: v.id("pautas"), date: v.string(), platform, format },
  handler: async (ctx, { pautaId, date, platform: plat, format: fmt }) => {
    const admin = await requireAdmin(ctx);
    const p = await ctx.db.get(pautaId);
    if (!p) throw new ConvexError("Pauta não encontrada.");
    if (p.contentId && (await ctx.db.get(p.contentId))) return p.contentId;
    if (!DATE.test(date)) throw new ConvexError("Escolha a data da peça.");
    const contentId = await ctx.db.insert("contents", {
      clientId: p.clientId,
      date,
      title: p.title,
      platform: plat,
      format: fmt,
      status: "producao",
      version: 1,
    });
    const author = await ctx.db.get(p.authorId);
    const body = [p.notes, p.files?.length ? `Anexos na pauta: ${p.files.map((f) => f.name).join(", ")}` : null]
      .filter(Boolean)
      .join("\n\n");
    const briefingId = await ctx.db.insert("briefings", {
      clientId: p.clientId,
      authorId: p.authorId,
      title: p.title,
      platform: plat,
      format: fmt,
      desiredDate: date,
      body: body || `Pauta de ${displayName(author)}: ${p.title}`,
      links: p.link ? [p.link] : [],
      status: "em_criacao",
      contentId,
    });
    await ctx.db.patch(contentId, { briefingId });
    await ctx.db.patch(pautaId, { status: "calendario", contentId });
    await logActivity(ctx, { clientId: p.clientId, contentId, userId: admin._id, kind: "criacao", summary: `Criou o conteúdo a partir da pauta "${p.title}"` });
    return contentId;
  },
});

export const remove = mutation({
  args: { pautaId: v.id("pautas") },
  handler: async (ctx, { pautaId }) => {
    const { p, viewer } = await load(ctx, pautaId);
    assertCanEdit(p, viewer);
    for (const f of p.files ?? []) await ctx.storage.delete(f.id);
    await ctx.db.delete(pautaId);
  },
});

/** Esteira do estúdio: pautas de todos os clientes que ainda não foram para o calendário. */
export const forStudio = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireAdmin(ctx);
    const clients = new Map((await ctx.db.query("clients").collect()).filter((c) => c.active).map((c) => [c._id as string, c]));
    const out = [];
    for (const status of ["nova", "vista"] as const) {
      const rows = await ctx.db
        .query("pautas")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
      for (const p of rows) {
        const c = clients.get(p.clientId);
        if (!c) continue;
        out.push({ ...(await shape(ctx, p, viewer)), client: { slug: c.slug, name: c.name, accentColor: c.accentColor } });
      }
    }
    return out.sort((a, b) => (a.month ?? "9").localeCompare(b.month ?? "9") || b.at - a.at);
  },
});
