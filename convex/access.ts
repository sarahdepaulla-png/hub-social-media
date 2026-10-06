import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { ADMIN_KEYS, sha256Hex } from "./lib/adminKey";

/** 32 caracteres aleatórios para o link de acesso. */
export function newToken(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/**
 * Entrada pelo link de acesso: acha o convite pelo token e devolve o usuário,
 * criando na primeira vez. Token apagado (acesso retirado) não entra mais.
 */
export const userForToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (token.length < 20) return null;
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!invite) return await adminByKey(ctx, token);
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", invite.email))
      .first();
    const userId =
      existing?._id ??
      (await ctx.db.insert("users", { email: invite.email, name: invite.name, role: invite.role, clientId: invite.clientId }));
    if (existing) {
      await ctx.db.patch(existing._id, { role: invite.role, clientId: invite.clientId, name: existing.name ?? invite.name });
    }
    if (!invite.acceptedAt) await ctx.db.patch(invite._id, { acceptedAt: Date.now() });
    return userId;
  },
});

/** Chave fixa da admin (ver lib/adminKey.ts): entra mesmo sem convite com token. */
async function adminByKey(ctx: MutationCtx, token: string) {
  const hash = await sha256Hex(token);
  const key = ADMIN_KEYS.find((k) => k.sha256 === hash);
  if (!key) return null;
  const existing = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", key.email))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, { role: "admin", clientId: undefined });
    return existing._id;
  }
  return await ctx.db.insert("users", { email: key.email, role: "admin" });
}

/**
 * Garante um link de acesso para cada admin (usado no deploy da Vercel,
 * que mostra os links no log do build). Assim a admin entra sem e-mail.
 */
export const ensureAdminLinks = internalMutation({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, { emails }) => {
    const out: { email: string; token: string }[] = [];
    for (const raw of emails) {
      const email = raw.trim().toLowerCase();
      if (!email) continue;
      const invite = await ctx.db
        .query("invites")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      let token = invite?.token;
      if (!invite) {
        token = newToken();
        await ctx.db.insert("invites", { email, role: "admin", token });
      } else if (!token || invite.role !== "admin") {
        token = token ?? newToken();
        await ctx.db.patch(invite._id, { role: "admin", clientId: undefined, token });
      }
      out.push({ email, token: token! });
    }
    return out;
  },
});
