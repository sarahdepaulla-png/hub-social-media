import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/** O que o e-mail precisa: peças ainda esperando, quem recebe e o link de cada um. */
export const noticeData = internalQuery({
  args: { noticeId: v.id("approvalNotices") },
  handler: async (ctx, { noticeId }) => {
    const notice = await ctx.db.get(noticeId);
    if (!notice || notice.sentAt) return null;
    const client = await ctx.db.get(notice.clientId);
    if (!client) return null;
    const pieces = [];
    for (const id of notice.contentIds) {
      const c = await ctx.db.get(id);
      // Só o que continua esperando decisão (a admin pode ter voltado atrás).
      if (c && c.status === "aguardando" && !c.deletedAt) pieces.push({ _id: c._id, title: c.title, date: c.date, format: c.format });
    }
    const people = new Map<string, { email: string; name: string | null; token: string | null }>();
    for (const u of await ctx.db.query("users").collect()) {
      if (u.role === "cliente" && u.clientId === client._id && u.email) {
        people.set(u.email.toLowerCase(), { email: u.email, name: u.name ?? null, token: null });
      }
    }
    for (const i of await ctx.db.query("invites").collect()) {
      if (i.clientId !== client._id || i.role !== "cliente") continue;
      const key = i.email.toLowerCase();
      const prev = people.get(key);
      people.set(key, { email: i.email, name: prev?.name ?? i.name ?? null, token: i.token ?? null });
    }
    const admins = (await ctx.db.query("users").collect()).filter((u) => u.role === "admin" && u.name);
    return {
      client: { name: client.name, slug: client.slug },
      pieces: pieces.sort((a, b) => a.date.localeCompare(b.date)),
      recipients: [...people.values()],
      adminName: admins[0]?.name ?? null,
    };
  },
});

export const markNotice = internalMutation({
  args: { noticeId: v.id("approvalNotices"), sentTo: v.optional(v.array(v.string())), error: v.optional(v.string()) },
  handler: async (ctx, { noticeId, sentTo, error }) => {
    if (!(await ctx.db.get(noticeId))) return;
    await ctx.db.patch(noticeId, error ? { error } : { sentAt: Date.now(), sentTo });
  },
});
