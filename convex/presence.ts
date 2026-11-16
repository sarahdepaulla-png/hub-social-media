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

/** Avisos do estúdio: tudo o que as clientes fizeram, quem está online e quando cada pessoa foi vista. */
export const feed = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const byId = new Map(users.map((u) => [u._id, u]));
    const clients = new Map((await ctx.db.query("clients").collect()).map((c) => [c._id, c]));
    const now = Date.now();

    const recent = await ctx.db.query("activity").order("desc").take(600);
    const items = [];
    for (const a of recent) {
      const who = byId.get(a.userId);
      if (!who || who.role === "admin") continue;
      if (a.summary.startsWith("Entrou no calendário com a aprovação")) continue; // já aparece como "aprovou o plano"
      const client = clients.get(a.clientId);
      if (!client) continue;
      const content = a.contentId ? await ctx.db.get(a.contentId) : null;
      items.push({
        _id: a._id,
        at: a._creationTime,
        kind: a.kind,
        summary: a.summary,
        who: displayName(who),
        client: { slug: client.slug, name: client.name, accentColor: client.accentColor },
        content: content && !content.deletedAt ? { _id: content._id, title: content.title } : null,
        unread: a._creationTime > (admin.noticesSeenAt ?? 0),
      });
      if (items.length >= 150) break;
    }

    const people = users
      .filter((u): u is Doc<"users"> & { clientId: NonNullable<Doc<"users">["clientId"]> } => u.role === "cliente" && !!u.clientId)
      .map((u) => {
        const client = clients.get(u.clientId);
        return {
          _id: u._id,
          name: displayName(u),
          client: client ? { slug: client.slug, name: client.name, accentColor: client.accentColor } : null,
          lastSeenAt: u.lastSeenAt ?? null,
          online: !!u.lastSeenAt && now - u.lastSeenAt < ONLINE_MS,
        };
      })
      .filter((p) => p.client)
      .sort((a, b) => Number(b.online) - Number(a.online) || (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));

    return { items, people, now };
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
