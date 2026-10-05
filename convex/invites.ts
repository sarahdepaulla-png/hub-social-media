import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { requireAdmin } from "./lib/access";
import { role } from "./schema";
import { newToken } from "./access";

const inviteArgs = { email: v.string(), name: v.optional(v.string()), role, clientSlug: v.optional(v.string()) };

/** Admin libera um e-mail para entrar, já ligado a um workspace. */
export const create = mutation({
  args: inviteArgs,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await upsertInvite(ctx, args);
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
