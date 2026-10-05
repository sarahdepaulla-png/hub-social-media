import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireClientBySlug } from "./lib/access";
import { logActivity } from "./lib/log";
import { opportunitiesFor } from "./lib/opportunities";

/** Datas do nicho do cliente num intervalo, com o que já foi feito com cada uma. */
export const forClient = query({
  args: { slug: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, { slug, from, to }) => {
    const { client } = await requireClientBySlug(ctx, slug);
    // Começa no dia 01 do mês para incluir datas de "mês todo" em curso.
    const opps = await opportunitiesFor(ctx, client, `${from.slice(0, 7)}-01`, to);
    const contents = await ctx.db
      .query("contents")
      .withIndex("by_client_date", (q) => q.eq("clientId", client._id))
      .collect();
    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .collect();
    return opps
      .filter((o) => o.allMonth || o.date >= from)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((o) => {
        const content = contents.find((c) => c.sourceOpportunityId === o._id);
        const idea = ideas.find((i) => i.opportunityId === o._id);
        return {
          _id: o._id,
          date: o.date,
          title: o.title,
          hint: o.hint ?? null,
          allMonth: !!o.allMonth,
          contentId: content?._id ?? idea?.contentId ?? null,
          requested: !!idea,
        };
      });
  },
});

/** Cliente pede conteúdo sobre uma data. Vira ideia na caixa do estúdio. */
export const request = mutation({
  args: { slug: v.string(), opportunityId: v.id("opportunities") },
  handler: async (ctx, { slug, opportunityId }) => {
    const { viewer, client } = await requireClientBySlug(ctx, slug);
    const opp = await ctx.db.get(opportunityId);
    if (!opp) throw new ConvexError("Data não encontrada.");
    const existing = await ctx.db
      .query("ideas")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .collect();
    if (existing.some((i) => i.opportunityId === opportunityId)) return;
    await ctx.db.insert("ideas", {
      clientId: client._id,
      authorId: viewer._id,
      title: opp.title,
      description: opp.hint ? `Pedido a partir da data. ${opp.hint}` : "Pedido a partir da data.",
      status: "nova",
      opportunityId,
    });
    await logActivity(ctx, { clientId: client._id, userId: viewer._id, kind: "ideia", summary: `Pediu conteúdo sobre "${opp.title}"` });
  },
});

/* ---------- Biblioteca (admin) ---------- */

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("opportunities").withIndex("by_date").collect();
    const clients = await ctx.db.query("clients").collect();
    return all.map((o) => ({
      _id: o._id,
      date: o.date,
      title: o.title,
      hint: o.hint ?? null,
      niches: o.niches,
      allMonth: !!o.allMonth,
      clientName: o.clientId ? (clients.find((c) => c._id === o.clientId)?.name ?? null) : null,
    }));
  },
});

export const create = mutation({
  args: {
    date: v.string(),
    title: v.string(),
    hint: v.optional(v.string()),
    niches: v.array(v.string()),
    allMonth: v.optional(v.boolean()),
    clientSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!args.title.trim()) throw new ConvexError("Dê um nome para a data.");
    let clientId = undefined;
    if (args.clientSlug) {
      const { client } = await requireClientBySlug(ctx, args.clientSlug);
      clientId = client._id;
    }
    if (!clientId && args.niches.length === 0) throw new ConvexError("Escolha ao menos um nicho ou um cliente.");
    return await ctx.db.insert("opportunities", {
      date: args.allMonth ? `${args.date.slice(0, 7)}-01` : args.date,
      title: args.title.trim(),
      hint: args.hint?.trim() || undefined,
      niches: args.niches,
      allMonth: args.allMonth,
      clientId,
    });
  },
});

export const remove = mutation({
  args: { opportunityId: v.id("opportunities") },
  handler: async (ctx, { opportunityId }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(opportunityId);
  },
});
