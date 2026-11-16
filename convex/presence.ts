import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getRealUser, requireAdmin } from "./lib/access";
import { displayName } from "./lib/log";

/** Online = deu sinal de vida nos últimos 3 minutos. */
const ONLINE_MS = 3 * 60 * 1000;
/** Nova "entrada no Hub" quando a pessoa volta depois de 30 minutos fora. */
const NEW_VISIT_MS = 30 * 60 * 1000;

/** O app chama a cada minuto enquanto está aberto. Só registra clientes de verdade. */
export const ping = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getRealUser(ctx);
    if (!user || user.role !== "cliente" || !user.clientId) return;
    const now = Date.now();
    const last = user.lastSeenAt ?? 0;
    if (now - last < 45 * 1000) return;
    if (now - last > NEW_VISIT_MS) {
      await ctx.db.insert("activity", { clientId: user.clientId, userId: user._id, kind: "entrada", summary: "Entrou no Hub" });
    }
    await ctx.db.patch(user._id, { lastSeenAt: now });
  },
});

/**
 * Avisos do estúdio, por cliente: cada pessoa com online / último acesso / última entrada,
 * e os movimentos daquela cliente, do mais novo para o mais antigo.
 */
export const feed = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const byId = new Map(users.map((u) => [u._id, u]));
    const clients = await ctx.db.query("clients").collect();
    const now = Date.now();
    const seenAt = admin.noticesSeenAt ?? 0;

    const recent = await ctx.db.query("activity").order("desc").take(800);
    const lastEntry = new Map<string, number>();
    const perClient = new Map<string, { _id: string; at: number; kind: string; summary: string; who: string; content: { _id: string; title: string } | null; unread: boolean }[]>();
    for (const a of recent) {
      const who = byId.get(a.userId);
      if (!who || who.role === "admin") continue;
      if (a.kind === "entrada" && !lastEntry.has(a.userId)) lastEntry.set(a.userId, a._creationTime);
      if (a.summary.startsWith("Entrou no calendário com a aprovação")) continue; // já aparece como "aprovou o plano"
      const list = perClient.get(a.clientId) ?? [];
      if (list.length >= 25) continue;
      const content = a.contentId ? await ctx.db.get(a.contentId) : null;
      list.push({
        _id: a._id,
        at: a._creationTime,
        kind: a.kind,
        summary: a.summary,
        who: displayName(who),
        content: content && !content.deletedAt ? { _id: content._id, title: content.title } : null,
        unread: a._creationTime > seenAt,
      });
      perClient.set(a.clientId, list);
    }

    const result = await Promise.all(
      clients.map(async (c) => {
        const people = users
          .filter((u): u is Doc<"users"> => u.role === "cliente" && u.clientId === c._id)
          .map((u) => ({
            _id: u._id,
            name: displayName(u),
            online: !!u.lastSeenAt && now - u.lastSeenAt < ONLINE_MS,
            lastSeenAt: u.lastSeenAt ?? null,
            lastEntryAt: lastEntry.get(u._id) ?? null,
          }))
          .sort((a, b) => Number(b.online) - Number(a.online) || (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
        const items = perClient.get(c._id) ?? [];
        return {
          slug: c.slug,
          name: c.name,
          accentColor: c.accentColor,
          photoUrl: c.photoId ? await ctx.storage.getUrl(c.photoId) : null,
          people,
          items,
          unread: items.filter((i) => i.unread).length,
          lastAt: Math.max(items[0]?.at ?? 0, ...people.map((p) => p.lastSeenAt ?? 0)),
        };
      }),
    );
    result.sort((a, b) => b.unread - a.unread || b.lastAt - a.lastAt);
    return { clients: result, now };
  },
});

/** Bolinha dos Avisos: quantas ações novas desde a última leitura. */
export const unread = query({
  args: {},
  handler: async (ctx) => {
    const user = await getRealUser(ctx);
    if (!user || user.role !== "admin") return null;
    const since = user.noticesSeenAt ?? 0;
    const recent = await ctx.db
      .query("activity")
      .withIndex("by_creation_time", (q) => q.gt("_creationTime", since))
      .order("desc")
      .take(200);
    let n = 0;
    for (const a of recent) {
      const who = await ctx.db.get(a.userId);
      if (who && who.role !== "admin") n++;
    }
    return n;
  },
});

export const markSeen = mutation({
  args: { at: v.optional(v.number()) },
  handler: async (ctx, { at }) => {
    const admin = await requireAdmin(ctx);
    const latest = await ctx.db.query("activity").order("desc").first();
    await ctx.db.patch(admin._id, { noticesSeenAt: at ?? Math.max(Date.now(), latest?._creationTime ?? 0) });
  },
});
