import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { format, platform } from "./schema";
import { requireAdmin, requireClientAccess, requireClientBySlug } from "./lib/access";
import { contentsInMonth, toCard } from "./lib/content";
import { displayName, logActivity } from "./lib/log";
import { TEAM, cleanOwner } from "./lib/team";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const fields = {
  title: v.string(),
  platform: v.optional(platform),
  format: v.optional(format),
  desiredDate: v.optional(v.string()),
  dueDate: v.optional(v.string()),
  owner: v.optional(v.string()),
  objective: v.optional(v.string()),
  body: v.string(),
  links: v.array(v.string()),
};

type Fields = {
  title: string;
  platform?: Doc<"briefings">["platform"];
  format?: Doc<"briefings">["format"];
  desiredDate?: string;
  dueDate?: string;
  owner?: string;
  objective?: string;
  body: string;
  links: string[];
};

/** Limpa e confere o que veio do formulário. */
function clean(f: Fields) {
  const title = f.title.trim();
  const body = f.body.trim();
  if (!title) throw new ConvexError("Diga o que é o conteúdo.");
  if (!body) throw new ConvexError("Escreva o briefing.");
  const desiredDate = f.desiredDate?.trim() || undefined;
  if (desiredDate && !DATE.test(desiredDate)) throw new ConvexError("Data inválida.");
  const dueDate = f.dueDate?.trim() || undefined;
  if (dueDate && !DATE.test(dueDate)) throw new ConvexError("Prazo inválido.");
  const links = f.links.map((l) => l.trim()).filter(Boolean);
  if (links.length > 10) throw new ConvexError("Até 10 links por briefing.");
  for (const l of links) {
    if (!/^https?:\/\/\S+$/i.test(l)) throw new ConvexError(`Link precisa começar com https:// (${l.slice(0, 40)})`);
  }
  return {
    title: title.slice(0, 160),
    platform: f.platform,
    format: f.format,
    desiredDate,
    dueDate,
    owner: cleanOwner(f.owner),
    objective: f.objective?.trim() || undefined,
    body: body.slice(0, 6000),
    links,
  };
}

async function shape(ctx: QueryCtx, b: Doc<"briefings">, viewer: Doc<"users">) {
  const author = await ctx.db.get(b.authorId);
  const content = b.contentId ? await ctx.db.get(b.contentId) : null;
  return {
    _id: b._id,
    title: b.title,
    platform: b.platform ?? null,
    format: b.format ?? null,
    desiredDate: b.desiredDate ?? null,
    // Prazo é combinado interno do estúdio.
    dueDate: viewer.role === "admin" ? (b.dueDate ?? null) : null,
    owner: viewer.role === "admin" ? (b.owner ?? null) : null,
    objective: b.objective ?? null,
    body: b.body,
    links: b.links,
    status: b.status,
    at: b._creationTime,
    authorName: author?.role === "admin" ? "Estúdio" : displayName(author),
    authorIsStudio: author?.role === "admin",
    canEdit: viewer.role === "admin" || (b.authorId === viewer._id && b.status === "novo"),
    content: content ? { _id: content._id, date: content.date, status: content.status } : null,
  };
}

async function load(ctx: QueryCtx, briefingId: Id<"briefings">) {
  const b = await ctx.db.get(briefingId);
  if (!b) throw new ConvexError("Briefing não encontrado.");
  const viewer = await requireClientAccess(ctx, b.clientId).catch(() => {
    throw new ConvexError("Briefing não encontrado.");
  });
  return { b, viewer };
}

/** Briefings do workspace, mais recentes primeiro. Arquivados só para a admin. */
export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { viewer, client } = await requireClientBySlug(ctx, slug);
    const rows = await ctx.db
      .query("briefings")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .order("desc")
      .collect();
    const out = [];
    for (const b of rows) {
      if (b.status === "arquivado" && viewer.role !== "admin") continue;
      out.push(await shape(ctx, b, viewer));
    }
    return out;
  },
});

export const get = query({
  args: { briefingId: v.id("briefings") },
  handler: async (ctx, { briefingId }) => {
    const { b, viewer } = await load(ctx, briefingId);
    if (b.status === "arquivado" && viewer.role !== "admin") throw new ConvexError("Briefing não encontrado.");
    return { ...(await shape(ctx, b, viewer)), viewerRole: viewer.role! };
  },
});

export const create = mutation({
  args: { slug: v.string(), ...fields },
  handler: async (ctx, { slug, ...f }) => {
    const { viewer, client } = await requireClientBySlug(ctx, slug);
    const data = clean(f);
    if (viewer.role !== "admin") {
      data.dueDate = undefined;
      data.owner = undefined;
    }
    const briefingId = await ctx.db.insert("briefings", {
      clientId: client._id,
      authorId: viewer._id,
      status: "novo",
      ...data,
    });
    await logActivity(ctx, { clientId: client._id, userId: viewer._id, kind: "briefing", summary: `Abriu o briefing "${data.title}"` });
    return briefingId;
  },
});

export const update = mutation({
  args: { briefingId: v.id("briefings"), ...fields },
  handler: async (ctx, { briefingId, ...f }) => {
    const { b, viewer } = await load(ctx, briefingId);
    if (viewer.role !== "admin" && (b.authorId !== viewer._id || b.status !== "novo")) {
      throw new ConvexError("Este briefing já está com o estúdio. Mande o que mudou pelos comentários da peça.");
    }
    const data = clean(f);
    // Quem não é admin não vê o prazo: mantém o que já estava.
    if (viewer.role !== "admin") {
      data.dueDate = b.dueDate;
      data.owner = b.owner;
    }
    await ctx.db.patch(briefingId, data);
    // A peça que nasceu deste briefing acompanha prazo e responsável.
    if (viewer.role === "admin" && b.contentId) await ctx.db.patch(b.contentId, { dueDate: data.dueDate, owner: data.owner });
  },
});

/** Escreve o briefing de uma peça que nasceu sem ele (só a admin). */
export const attach = mutation({
  args: { contentId: v.id("contents"), ...fields },
  handler: async (ctx, { contentId, ...f }) => {
    const admin = await requireAdmin(ctx);
    const content = await ctx.db.get(contentId);
    if (!content) throw new ConvexError("Conteúdo não encontrado.");
    if (content.briefingId && (await ctx.db.get(content.briefingId))) {
      throw new ConvexError("Esta peça já tem briefing. Edite o que existe.");
    }
    const briefingId = await ctx.db.insert("briefings", {
      clientId: content.clientId,
      authorId: admin._id,
      status: "em_criacao",
      contentId,
      ...clean(f),
    });
    const saved = (await ctx.db.get(briefingId))!;
    await ctx.db.patch(contentId, {
      briefingId,
      dueDate: saved.dueDate ?? content.dueDate,
      owner: saved.owner ?? content.owner,
    });
    return briefingId;
  },
});

/** Começa a criação: o briefing vira uma peça em produção no calendário. */
export const start = mutation({
  args: { briefingId: v.id("briefings"), date: v.string(), platform, format },
  handler: async (ctx, { briefingId, date, platform: plat, format: fmt }) => {
    const admin = await requireAdmin(ctx);
    const b = await ctx.db.get(briefingId);
    if (!b) throw new ConvexError("Briefing não encontrado.");
    if (b.contentId) return b.contentId;
    if (!DATE.test(date)) throw new ConvexError("Escolha a data da peça.");
    const contentId = await ctx.db.insert("contents", {
      clientId: b.clientId,
      date,
      title: b.title,
      platform: plat,
      format: fmt,
      objective: b.objective,
      status: "producao",
      version: 1,
      briefingId,
      dueDate: b.dueDate,
      owner: b.owner,
    });
    await ctx.db.patch(briefingId, { status: "em_criacao", contentId });
    await logActivity(ctx, { clientId: b.clientId, contentId, userId: admin._id, kind: "criacao", summary: `Criou o conteúdo a partir do briefing "${b.title}"` });
    return contentId;
  },
});

export const archive = mutation({
  args: { briefingId: v.id("briefings"), archived: v.boolean() },
  handler: async (ctx, { briefingId, archived }) => {
    await requireAdmin(ctx);
    const b = await ctx.db.get(briefingId);
    if (!b) throw new ConvexError("Briefing não encontrado.");
    await ctx.db.patch(briefingId, { status: archived ? "arquivado" : b.contentId ? "em_criacao" : "novo" });
  },
});

/** Quem abriu apaga enquanto ninguém começou. A admin apaga quando quiser. */
export const remove = mutation({
  args: { briefingId: v.id("briefings") },
  handler: async (ctx, { briefingId }) => {
    const { b, viewer } = await load(ctx, briefingId);
    if (viewer.role !== "admin" && (b.authorId !== viewer._id || b.status !== "novo")) {
      throw new ConvexError("Este briefing já está com o estúdio.");
    }
    if (b.contentId) {
      const content = await ctx.db.get(b.contentId);
      if (content?.briefingId === briefingId) await ctx.db.patch(content._id, { briefingId: undefined });
    }
    await ctx.db.delete(briefingId);
  },
});

/** Esteira de criação do estúdio: briefings em aberto e as peças do mês por etapa. */
export const pipeline = query({
  args: { month: v.string() },
  handler: async (ctx, { month }) => {
    const viewer = await requireAdmin(ctx);
    const clients = (await ctx.db.query("clients").collect()).filter((c) => c.active);
    const byId = new Map(clients.map((c) => [c._id as string, c]));
    const client = (id: Id<"clients">) => {
      const c = byId.get(id)!;
      return { _id: c._id, slug: c.slug, name: c.name, accentColor: c.accentColor };
    };

    const open = await ctx.db
      .query("briefings")
      .withIndex("by_status", (q) => q.eq("status", "novo"))
      .collect();
    const briefings = [];
    for (const b of open.filter((b) => byId.has(b.clientId))) {
      briefings.push({ ...(await shape(ctx, b, viewer)), client: client(b.clientId) });
    }
    briefings.sort((a, b) => (a.dueDate ?? a.desiredDate ?? "9").localeCompare(b.dueDate ?? b.desiredDate ?? "9") || a.at - b.at);

    const contents = [];
    for (const c of clients) {
      for (const item of await contentsInMonth(ctx, c._id, month)) {
        contents.push({
          ...(await toCard(ctx, item)),
          client: client(c._id),
          fromBriefing: !!item.briefingId,
          dueDate: item.dueDate ?? null,
          owner: item.owner ?? null,
        });
      }
    }
    contents.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));

    const team = [...new Set([...TEAM, ...briefings.map((b) => b.owner), ...contents.map((c) => c.owner)].filter((o): o is string => !!o))];
    return { clients: clients.map((c) => client(c._id)), briefings, contents, team };
  },
});
