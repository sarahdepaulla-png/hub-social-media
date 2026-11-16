import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Guarda uma cópia de como algo estava antes de mudar. Fica no Histórico de versões. */
export async function saveRevision(
  ctx: MutationCtx,
  r: { clientId: Id<"clients">; kind: "briefing" | "conteudo" | "legendas" | "plano"; targetId: string; label: string; reason: string; data: unknown },
) {
  const userId = (await getAuthUserId(ctx)) ?? undefined;
  await ctx.db.insert("revisions", { ...r, userId });
}
