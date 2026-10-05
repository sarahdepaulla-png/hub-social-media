import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/** Datas que valem para o cliente: do nicho dele ou cadastradas só para ele. */
export async function opportunitiesFor(ctx: QueryCtx, client: Doc<"clients">, from: string, to: string) {
  const all = await ctx.db
    .query("opportunities")
    .withIndex("by_date", (q) => q.gte("date", from).lte("date", to))
    .collect();
  return all.filter((o) => (o.clientId ? o.clientId === client._id : o.niches.some((n) => client.niches.includes(n))));
}
