import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireAdmin, requireClientBySlug, type Viewer } from "./lib/access";
import { displayName, logActivity } from "./lib/log";

/** O recado que está no ar. Some sozinho depois de `until`. */
export const NOTICE = { key: "recesso-2026", until: "2026-12-12" } as const;

const ANSWER_TEXT = {
  continuar: "quer continuar em 2027",
  pensar: "vai pensar e te fala",
} as const;

function today() {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); // horário de Brasília
}

/** Nome para o "Oi": cliente de uma pessoa só é chamada pelo nome da conta (ex.: Vivi). */
async function hello(ctx: QueryCtx, client: Doc<"clients">, user: Doc<"users"> | null) {
  const team = (await ctx.db.query("users").collect()).filter((u) => u.role === "cliente" && u.clientId === client._id);
  const name = team.length <= 1 || !user ? client.name : displayName(user);
  return { firstName: name.split(" ")[0], plural: team.length > 1 };
}

/** O que o chat precisa: para quem é, a foto do estúdio e se já respondeu. */
export const mine = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    if (today() >= NOTICE.until) return null;
    const { viewer: vw, client } = await requireClientBySlug(ctx, slug);
    const viewer = vw as Viewer;
    // A admin só vê o chat em "Ver como cliente" (prévia: não conta como visto).
    if (viewer.role === "admin") return null;
    const preview = !!viewer.viewingAs;
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    const read =
      userId && !preview
        ? await ctx.db
            .query("noticeReads")
            .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", NOTICE.key))
            .unique()
        : null;
    const admin = (await ctx.db.query("users").collect()).find((u) => u.role === "admin" && u.photoId);
    return {
      key: NOTICE.key,
      preview,
      ...(await hello(ctx, client, preview ? null : user)),
      photoUrl: admin?.photoId ? await ctx.storage.getUrl(admin.photoId) : null,
      seenAt: read?.seenAt ?? null,
      answer: read?.answer ?? null,
    };
  },
});

async function upsert(ctx: Parameters<typeof logActivity>[0], slug: string) {
  const { viewer: vw, client } = await requireClientBySlug(ctx, slug);
  const viewer = vw as Viewer;
  if (viewer.role === "admin" || viewer.viewingAs) return null; // prévia da admin não conta
  const userId = (await getAuthUserId(ctx))!;
  const read = await ctx.db
    .query("noticeReads")
    .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", NOTICE.key))
    .unique();
  if (read) return { read, client, userId };
  const id = await ctx.db.insert("noticeReads", { key: NOTICE.key, userId, clientId: client._id, seenAt: Date.now() });
  await logActivity(ctx, { clientId: client._id, userId, kind: "recado", summary: "Viu o recado do recesso" });
  return { read: (await ctx.db.get(id))!, client, userId };
}

/** Abriu o chat: conta como visto. */
export const seen = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await upsert(ctx, slug);
  },
});

/** Resposta da cliente. Avisa o estúdio no Avisos e por e-mail. */
export const answer = mutation({
  args: { slug: v.string(), answer: v.union(v.literal("continuar"), v.literal("pensar")) },
  handler: async (ctx, { slug, answer }) => {
    const r = await upsert(ctx, slug);
    if (!r) return;
    if (r.read.answer === answer) return;
    await ctx.db.patch(r.read._id, { answer, answeredAt: Date.now() });
    await logActivity(ctx, { clientId: r.client._id, userId: r.userId, kind: "recado", summary: `Respondeu o recado do recesso: ${ANSWER_TEXT[answer]}` });
    const user = await ctx.db.get(r.userId);
    await ctx.scheduler.runAfter(0, internal.mailer.sendNoticeAnswer, {
      clientName: r.client.name,
      slug: r.client.slug,
      who: displayName(user),
      answer,
    });
  },
});

/** Estúdio: quem de cada cliente viu e o que respondeu. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const reads = await ctx.db
      .query("noticeReads")
      .withIndex("by_key", (q) => q.eq("key", NOTICE.key))
      .collect();
    const users = (await ctx.db.query("users").collect()).filter((u) => u.role === "cliente" && u.clientId);
    const clients = (await ctx.db.query("clients").collect()).filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name));
    return {
      until: NOTICE.until,
      live: today() < NOTICE.until,
      clients: clients.map((c) => ({
        name: c.name,
        slug: c.slug,
        accentColor: c.accentColor,
        people: users
          .filter((u) => u.clientId === c._id)
          .map((u) => {
            const r = reads.find((x) => x.userId === u._id);
            return { name: displayName(u), seenAt: r?.seenAt ?? null, answer: r?.answer ?? null, answeredAt: r?.answeredAt ?? null };
          }),
      })),
    };
  },
});

/** E-mails do estúdio (ADMIN_EMAILS + contas admin). */
export const adminEmails = internalQuery({
  args: {},
  handler: async (ctx) => {
    const fromEnv = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
    const fromUsers = (await ctx.db.query("users").collect()).filter((u) => u.role === "admin" && u.email).map((u) => u.email!);
    return [...new Set([...fromEnv, ...fromUsers].map((e) => e.toLowerCase()))];
  },
});

