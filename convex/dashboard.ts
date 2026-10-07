import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireClientBySlug } from "./lib/access";
import { contentsInMonth, countByStatus, toCard } from "./lib/content";

/** Início do workspace: mês atual, contadores, fila de aprovação e próximos. */
export const forClient = query({
  args: { slug: v.string(), month: v.string(), today: v.string() },
  handler: async (ctx, { slug, month, today }) => {
    const { client } = await requireClientBySlug(ctx, slug);
    const list = (await contentsInMonth(ctx, client._id, month)).sort((a, b) => a.date.localeCompare(b.date));

    const waiting = await Promise.all(list.filter((c) => c.status === "aguardando").map((c) => toCard(ctx, c)));
    const adjusting = await Promise.all(list.filter((c) => c.status === "ajuste").map((c) => toCard(ctx, c)));
    const upcoming = await Promise.all(
      list
        .filter((c) => c.date >= today && c.status !== "ideia" && c.status !== "aguardando")
        .slice(0, 5)
        .map((c) => toCard(ctx, c)),
    );

    return { counts: countByStatus(list), waiting, adjusting, upcoming };
  },
});

/** O que pede ação da admin agora: ajustes pedidos e ideias novas. */
export const studioInbox = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const clients = await ctx.db.query("clients").collect();
    const byId = new Map<string, (typeof clients)[number]>(clients.map((c) => [c._id, c]));
    const items: {
      kind: "ajuste" | "ideias" | "briefing" | "pautas";
      briefingId?: string;
      clientSlug: string;
      clientName: string;
      accentColor: string;
      title: string;
      detail: string | null;
      at: number;
      contentId: string | null;
      coverUrl: string | null;
    }[] = [];

    for (const client of clients) {
      const adjusting = await ctx.db
        .query("contents")
        .withIndex("by_client_status", (q) => q.eq("clientId", client._id).eq("status", "ajuste"))
        .collect();
      for (const content of adjusting.filter((c) => !c.deletedAt)) {
        const last = await ctx.db
          .query("decisions")
          .withIndex("by_content", (q) => q.eq("contentId", content._id))
          .order("desc")
          .first();
        items.push({
          kind: "ajuste",
          clientSlug: client.slug,
          clientName: client.name,
          accentColor: client.accentColor,
          title: content.title,
          detail: last?.comment ?? null,
          at: last?._creationTime ?? content._creationTime,
          contentId: content._id,
          coverUrl: content.coverId ? await ctx.storage.getUrl(content.coverId) : null,
        });
      }
    }

    const ideas = await ctx.db.query("ideas").collect();
    const fresh = new Map<string, typeof ideas>();
    for (const idea of ideas.filter((i) => i.status === "nova")) {
      const arr = fresh.get(idea.clientId) ?? [];
      arr.push(idea);
      fresh.set(idea.clientId, arr);
    }
    for (const [clientId, list] of fresh) {
      const client = byId.get(clientId);
      if (!client) continue;
      items.push({
        kind: "ideias",
        clientSlug: client.slug,
        clientName: client.name,
        accentColor: client.accentColor,
        title: list.length === 1 ? "1 ideia nova" : `${list.length} ideias novas`,
        detail: list.map((i) => i.title).join(", "),
        at: Math.max(...list.map((i) => i._creationTime)),
        contentId: null,
        coverUrl: null,
      });
    }

    // Pautas novas que a cliente colocou no banco, agrupadas por cliente.
    const newPautas = await ctx.db
      .query("pautas")
      .withIndex("by_status", (q) => q.eq("status", "nova"))
      .collect();
    const pautasBy = new Map<string, typeof newPautas>();
    for (const p of newPautas) pautasBy.set(p.clientId, [...(pautasBy.get(p.clientId) ?? []), p]);
    for (const [clientId, list] of pautasBy) {
      const client = byId.get(clientId);
      if (!client) continue;
      items.push({
        kind: "pautas",
        clientSlug: client.slug,
        clientName: client.name,
        accentColor: client.accentColor,
        title: list.length === 1 ? "1 pauta nova" : `${list.length} pautas novas`,
        detail: list.map((p) => p.title).join(", "),
        at: Math.max(...list.map((p) => p._creationTime)),
        contentId: null,
        coverUrl: null,
      });
    }

    // Briefings que a cliente abriu e ainda não entraram em criação.
    const briefs = await ctx.db
      .query("briefings")
      .withIndex("by_status", (q) => q.eq("status", "novo"))
      .collect();
    for (const b of briefs) {
      const client = byId.get(b.clientId);
      const author = await ctx.db.get(b.authorId);
      if (!client || author?.role === "admin") continue;
      items.push({
        kind: "briefing",
        briefingId: b._id,
        clientSlug: client.slug,
        clientName: client.name,
        accentColor: client.accentColor,
        title: b.title,
        detail: b.body.slice(0, 140),
        at: b._creationTime,
        contentId: null,
        coverUrl: null,
      });
    }

    return items.sort((a, b) => b.at - a.at);
  },
});

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function plusDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
  return dt.toISOString().slice(0, 10);
}

/**
 * Página inicial do estúdio: quem está logada, o que atrasou,
 * a semana pela frente e os números que pedem atenção.
 */
export const studioHome = query({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const me = await requireAdmin(ctx);
    if (!DATE.test(today)) throw new ConvexError("Data inválida.");
    const weekEnd = plusDays(today, 6);
    const month = today.slice(0, 7);
    const clients = (await ctx.db.query("clients").collect()).filter((c) => c.active);

    const late = [];
    const week = [];
    const counts = { late: 0, today: 0, week: 0, aguardando: 0, ajuste: 0, postadosMes: 0 };

    for (const client of clients) {
      const info = { slug: client.slug, name: client.name, accentColor: client.accentColor };
      const all = await ctx.db
        .query("contents")
        .withIndex("by_client_date", (q) => q.eq("clientId", client._id))
        .collect();
      for (const c of all) {
        if (c.deletedAt) continue;
        if (c.status === "aguardando") counts.aguardando++;
        if (c.status === "ajuste") counts.ajuste++;
        if (c.status === "publicado" && c.date.startsWith(month)) counts.postadosMes++;
        // Atrasado: a data passou e a peça não foi marcada como postada.
        if (c.date < today && c.status !== "publicado") {
          const days = Math.round((Date.parse(today) - Date.parse(c.date)) / 86_400_000);
          late.push({ ...(await toCard(ctx, c)), client: info, daysLate: days });
        }
        if (c.date >= today && c.date <= weekEnd) {
          week.push({ ...(await toCard(ctx, c)), client: info });
          if (c.date === today) counts.today++;
        }
      }
    }
    counts.late = late.length;
    counts.week = week.length;
    late.sort((a, b) => a.date.localeCompare(b.date));
    week.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));

    return {
      me: {
        name: me.name ?? me.email?.split("@")[0] ?? null,
        photoUrl: me.photoId ? await ctx.storage.getUrl(me.photoId) : null,
      },
      counts,
      late,
      week,
    };
  },
});

/** Nome e foto da admin na página inicial. */
export const updateProfile = mutation({
  args: { name: v.optional(v.string()), photoId: v.optional(v.id("_storage")), removePhoto: v.optional(v.boolean()) },
  handler: async (ctx, { name, photoId, removePhoto }) => {
    const me = await requireAdmin(ctx);
    const patch: { name?: string; photoId?: typeof photoId } = {};
    if (name !== undefined) {
      const n = name.trim().slice(0, 60);
      if (!n) throw new ConvexError("Escreva seu nome.");
      patch.name = n;
    }
    if (photoId || removePhoto) {
      if (me.photoId) await ctx.storage.delete(me.photoId);
      patch.photoId = removePhoto ? undefined : photoId;
    }
    await ctx.db.patch(me._id, patch);
  },
});
