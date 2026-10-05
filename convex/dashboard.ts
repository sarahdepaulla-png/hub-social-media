import { v } from "convex/values";
import { query } from "./_generated/server";
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
      kind: "ajuste" | "ideias" | "briefing";
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
      for (const content of adjusting) {
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
