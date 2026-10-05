import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/** Registro do histórico. Tudo que muda numa peça passa por aqui. */
export async function logActivity(
  ctx: MutationCtx,
  entry: {
    clientId: Id<"clients">;
    contentId?: Id<"contents">;
    userId: Id<"users">;
    kind: "status" | "decisao" | "comentario" | "versao" | "edicao" | "legenda" | "midia" | "ideia" | "criacao";
    summary: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await ctx.db.insert("activity", entry);
}

export function displayName(user: { name?: string; email?: string; role?: string } | null) {
  if (!user) return "Alguém";
  return user.name ?? user.email?.split("@")[0] ?? "Alguém";
}
