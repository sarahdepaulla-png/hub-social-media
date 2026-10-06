import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError } from "convex/values";
import { requireAdmin } from "./lib/access";
import { role } from "./schema";
import type { Id } from "./_generated/dataModel";
import { newToken } from "./access";

const inviteArgs = { email: v.string(), name: v.optional(v.string()), role, clientSlug: v.optional(v.string()) };

/** Admin libera um e-mail para entrar, já ligado a um workspace. Pode já mandar o convite por e-mail. */
export const create = mutation({
  args: { ...inviteArgs, sendEmail: v.optional(v.boolean()) },
  handler: async (ctx, { sendEmail, ...args }) => {
    await requireAdmin(ctx);
    const inviteId = await upsertInvite(ctx, args);
    if (sendEmail) await queueEmail(ctx, inviteId);
    return inviteId;
  },
});

/** Envia (ou reenvia) o convite com o link de acesso para o e-mail da pessoa. */
export const sendEmail = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, { inviteId }) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(inviteId))) throw new ConvexError("Acesso não encontrado.");
    await queueEmail(ctx, inviteId);
  },
});

async function queueEmail(ctx: MutationCtx, inviteId: Id<"invites">) {
  await ctx.db.patch(inviteId, { emailPending: true, emailError: undefined });
  await ctx.scheduler.runAfter(0, internal.mailer.sendInvite, { inviteId });
}

/** Este e-mail pode entrar? (admin da lista ou alguém com acesso criado) */
export const canSignIn = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const e = email.trim().toLowerCase();
    const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((x) => x.trim().toLowerCase());
    if (admins.includes(e)) return true;
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", e))
      .unique();
    if (invite) return true;
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", e))
      .first();
    return !!user?.role;
  },
});

export const forEmail = internalQuery({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, { inviteId }) => {
    const invite = await ctx.db.get(inviteId);
    if (!invite?.token) return null;
    const client = invite.clientId ? await ctx.db.get(invite.clientId) : null;
    const admins = (await ctx.db.query("users").collect()).filter((u) => u.role === "admin" && u.name);
    return {
      email: invite.email,
      name: invite.name ?? null,
      token: invite.token,
      clientName: client?.name ?? null,
      adminName: admins[0]?.name ?? null,
    };
  },
});

export const markEmail = internalMutation({
  args: { inviteId: v.id("invites"), error: v.optional(v.string()) },
  handler: async (ctx, { inviteId, error }) => {
    if (!(await ctx.db.get(inviteId))) return;
    await ctx.db.patch(inviteId, error ? { emailPending: false, emailError: error } : { emailPending: false, emailError: undefined, emailedAt: Date.now() });
  },
});

/** O envio por e-mail está ligado? (para a tela avisar antes de tentar) */
export const mailStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return { ready: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD), from: process.env.GMAIL_USER ?? null };
  },
});

/** Mesma coisa pelo terminal: npx convex run invites:createFromCli '{...}' */
export const createFromCli = internalMutation({
  args: inviteArgs,
  handler: async (ctx, args) => await upsertInvite(ctx, args),
});

async function upsertInvite(
  ctx: MutationCtx,
  args: { email: string; name?: string; role: "admin" | "cliente"; clientSlug?: string },
) {
  {
    const email = args.email.trim().toLowerCase();
    let clientId = undefined;
    if (args.role === "cliente") {
      if (!args.clientSlug) throw new Error("Convite de cliente precisa de um workspace.");
      const client = await ctx.db
        .query("clients")
        .withIndex("by_slug", (q) => q.eq("slug", args.clientSlug!))
        .unique();
      if (!client) throw new Error("Workspace não encontrado.");
      clientId = client._id;
    }
    const existing = await ctx.db
      .query("invites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    // Se a pessoa já entrou antes, aplica o acesso na hora.
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (user) await ctx.db.patch(user._id, { role: args.role, clientId });
    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role, clientId, name: args.name, token: existing.token ?? newToken() });
      return existing._id;
    }
    return await ctx.db.insert("invites", { email, name: args.name, role: args.role, clientId, token: newToken() });
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("invites").collect();
  },
});

/** Gera um link novo e invalida o anterior (se o link vazou). */
export const resetLink = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, { inviteId }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(inviteId, { token: newToken() });
  },
});

/** Tira o acesso: o convite some e a pessoa perde o workspace na hora. */
export const revoke = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, { inviteId }) => {
    const admin = await requireAdmin(ctx);
    const invite = await ctx.db.get(inviteId);
    if (!invite) return;
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", invite.email))
      .first();
    if (user && user._id !== admin._id) await ctx.db.patch(user._id, { role: undefined, clientId: undefined });
    await ctx.db.delete(inviteId);
  },
});
