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
    const contents = await Promise.all(list.map((c) => toCard(ctx, c)));
    const opps = await opportunitiesFor(ctx, client, `${month}-01`, `${month}-31`);
    return {
      contents,
      opportunities: opps.map((o: Doc<"opportunities">) => ({
        _id: o._id,
        date: o.date,
        title: o.title,
        allMonth: !!o.allMonth,
      })),
    };
  },
});
