import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/** Registro do histórico. Tudo que muda numa peça passa por aqui. */
export async function logActivity(
  ctx: MutationCtx,
  entry: {
    clientId: Id<"clients">;
    contentId?: Id<"contents">;
    userId: Id<"users">;
    kind: "status" | "decisao" | "comentario" | "versao" | "edicao" | "legenda" | "midia" | "ideia" | "criacao" | "briefing" | "entrada" | "plano";
    summary: string;
    before?: unknown;
    after?: unknown;
  },
) {
  // Salvamento automático: edições seguidas da mesma pessoa na mesma peça viram uma linha só.
  if (entry.contentId && (entry.kind === "edicao" || entry.kind === "legenda")) {
    const contentId = entry.contentId;
    const recent = await ctx.db
      .query("activity")
      .withIndex("by_content", (q) => q.eq("contentId", contentId))
      .order("desc")
      .first();
    if (recent && recent.userId === entry.userId && recent.kind === entry.kind && Date.now() - recent._creationTime < 10 * 60 * 1000) {
      await ctx.db.patch(recent._id, { summary: mergeSummary(recent.summary, entry.summary), after: mergeAfter(recent.after, entry.after) });
      return;
    }
  }
  await ctx.db.insert("activity", entry);
}

/** Junta os campos alterados nas gravações seguidas (o valor mais novo de cada um vence). */
function mergeAfter(a: unknown, b: unknown) {
  if (a && b && typeof a === "object" && typeof b === "object") return { ...(a as object), ...(b as object) };
  return b ?? a;
}

/** "Alterou Tema" + "Alterou Data" = "Alterou Tema, Data". */
function mergeSummary(a: string, b: string) {
  const pre = "Alterou ";
  if (!a.startsWith(pre) || !b.startsWith(pre)) return b;
  const parts = [...a.slice(pre.length).split(", "), ...b.slice(pre.length).split(", ")];
  return pre + [...new Set(parts)].join(", ");
}

export function displayName(user: { name?: string; email?: string; role?: string } | null) {
  if (!user) return "Alguém";
  return user.name ?? user.email?.split("@")[0] ?? "Alguém";
}
