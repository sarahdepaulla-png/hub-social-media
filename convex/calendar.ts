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
    // (vale também para o plano do mês anterior, que pode trazer posts do começo deste mês)
    const [py, pm] = month.split("-").map(Number);
    const prevMonth = pm === 1 ? `${py - 1}-12` : `${py}-${String(pm - 1).padStart(2, "0")}`;
    const plans = (
      await Promise.all(
        [month, prevMonth].map((m) =>
          ctx.db
            .query("monthPlans")
            .withIndex("by_client_month", (q) => q.eq("clientId", client._id).eq("month", m))
            .first(),
        ),
      )
    ).filter((p) => p !== null);
    const pending = plans.filter((p) => p.status !== "aprovado");
    const plan = pending.find((p) => p.month === month) ?? pending[0] ?? null;
    const waitingIds = new Set(pending.flatMap((p) => p.pieces.map((x) => x.contentId)));
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
      planHeld: held.length && plan ? { count: held.length, status: plan.status, month: plan.month } : null,
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
