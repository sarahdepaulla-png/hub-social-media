import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Janela em que várias gravações seguidas da mesma pessoa contam como uma edição só. */
export const EDIT_SESSION_MS = 10 * 60 * 1000;

/**
 * Guarda uma cópia de como algo estava antes de mudar. Fica no Histórico de versões.
 * Com o salvamento automático, uma edição vira várias gravações seguidas: só a primeira
 * guarda versão (o "antes" da sessão). Apagar e restaurar sempre guardam.
 */
export async function saveRevision(
  ctx: MutationCtx,
  r: { clientId: Id<"clients">; kind: "briefing" | "conteudo" | "legendas" | "plano"; targetId: string; label: string; reason: string; data: unknown },
) {
  const userId = (await getAuthUserId(ctx)) ?? undefined;
  if (!/apagar|restaurar/i.test(r.reason)) {
    const last = await ctx.db
      .query("revisions")
      .withIndex("by_target", (q) => q.eq("targetId", r.targetId))
      .order("desc")
      .first();
    if (last && last.kind === r.kind && last.userId === userId && last.reason === r.reason && Date.now() - last._creationTime < EDIT_SESSION_MS) return;
  }
  await ctx.db.insert("revisions", { ...r, userId });
}
