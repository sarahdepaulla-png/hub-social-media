import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Aviso de "tem conteúdo para aprovar".
 * Espera alguns minutos antes de mandar: várias peças enviadas em seguida viram um e-mail só.
 */
export const NOTICE_DELAY_MS = 3 * 60_000;

export async function queueApprovalNotice(ctx: MutationCtx, clientId: Id<"clients">, contentId: Id<"contents">) {
  const client = await ctx.db.get(clientId);
  if (!client || client.notifyApproval === false) return;
  const pending = (await ctx.db
    .query("approvalNotices")
    .withIndex("by_client", (q) => q.eq("clientId", clientId))
    .collect()).find((n) => !n.sentAt && !n.error);
  if (pending) {
    if (!pending.contentIds.includes(contentId)) await ctx.db.patch(pending._id, { contentIds: [...pending.contentIds, contentId] });
    return;
  }
  const sendAt = Date.now() + NOTICE_DELAY_MS;
  const noticeId = await ctx.db.insert("approvalNotices", { clientId, contentIds: [contentId], sendAt });
  await ctx.scheduler.runAt(sendAt, internal.mailer.sendApproval, { noticeId });
}

