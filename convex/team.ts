import { query } from "./_generated/server";
import { requireAdmin } from "./lib/access";
import { TEAM } from "./lib/team";

/** Nomes para "com quem está": a equipe fixa e quem já apareceu nas demandas. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const used = new Set<string>();
    for (const b of await ctx.db.query("briefings").collect()) if (b.owner) used.add(b.owner);
    for (const c of await ctx.db.query("contents").withIndex("by_deleted", (q) => q.eq("deletedAt", undefined)).collect()) {
      if (c.owner) used.add(c.owner);
    }
    return [...new Set([...TEAM, ...[...used].sort((a, b) => a.localeCompare(b, "pt-BR"))])];
  },
});
