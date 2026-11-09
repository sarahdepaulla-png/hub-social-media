import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireClientBySlug } from "./lib/access";
import { contentsInMonth, toCard } from "./lib/content";
import { opportunitiesFor } from "./lib/opportunities";

/** O mês inteiro de um cliente: peças com capa e datas do nicho. */
export const month = query({
  args: { slug: v.string(), month: v.string() },
  handler: async (ctx, { slug, month }) => {
    const { client } = await requireClientBySlug(ctx, slug);
    const list = (await contentsInMonth(ctx, client._id, month)).sort(
      (a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""),
    );
    // Ideias do plano do mês só entram no calendário quando a cliente aprova o plano.
    const plan = await ctx.db
      .query("monthPlans")
      .withIndex("by_client_month", (q) => q.eq("clientId", client._id).eq("month", month))
      .first();
    const waitingIds = new Set(plan && plan.status !== "aprovado" ? plan.pieces.map((p) => p.contentId) : []);
    const held = list.filter((c) => c.status === "ideia" && waitingIds.has(c._id));
    const contents = await Promise.all(list.filter((c) => !held.includes(c)).map((c) => toCard(ctx, c)));
    const briefings = (
      await ctx.db
        .query("briefings")
        .withIndex("by_client", (q) => q.eq("clientId", client._id))
        .collect()
    ).filter((b) => b.status === "novo" && b.desiredDate && b.desiredDate >= `${month}-01` && b.desiredDate <= `${month}-31`);
    const opps = await opportunitiesFor(ctx, client, `${month}-01`, `${month}-31`);
    return {
      contents,
      planHeld: held.length ? { count: held.length, status: plan!.status } : null,
      briefings: briefings.map((b) => ({ _id: b._id, date: b.desiredDate!, title: b.title })),
      opportunities: opps.map((o: Doc<"opportunities">) => ({
        _id: o._id,
        date: o.date,
        title: o.title,
        allMonth: !!o.allMonth,
      })),
    };
  },
});
