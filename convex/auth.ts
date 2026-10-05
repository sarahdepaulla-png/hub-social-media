import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { EmailOTP } from "./otp";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    EmailOTP,
    // Link de acesso: o cliente entra pelo link do WhatsApp, sem e-mail nem domínio.
    ConvexCredentials({
      id: "link",
      authorize: async (credentials, ctx) => {
        const token = typeof credentials.token === "string" ? credentials.token : "";
        const userId = await ctx.runMutation(internal.access.userForToken, { token });
        return userId ? { userId } : null;
      },
    }),
  ],
  session: {
    // Cliente abre pelo WhatsApp: entra uma vez e fica logada 30 dias.
    totalDurationMs: 1000 * 60 * 60 * 24 * 30,
    inactiveDurationMs: 1000 * 60 * 60 * 24 * 30,
  },
  callbacks: {
    // Aplica o convite (papel e workspace) assim que o usuário existe.
    async afterUserCreatedOrUpdated(anyCtx, { userId }) {
      const ctx = anyCtx as unknown as MutationCtx;
      const user = await ctx.db.get(userId as Id<"users">);
      const email = (user?.email as string | undefined)?.toLowerCase();
      if (!user || !email) return;

      if (adminEmails().includes(email)) {
        await ctx.db.patch(userId as Id<"users">, { role: "admin" });
        return;
      }
      const invite = await ctx.db
        .query("invites")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (!invite) return;
      await ctx.db.patch(userId as Id<"users">, {
        role: invite.role,
        clientId: invite.clientId,
        name: (user.name as string | undefined) ?? invite.name,
      });
      if (!invite.acceptedAt) await ctx.db.patch(invite._id, { acceptedAt: Date.now() });
    },
    // Só entra quem foi convidado ou é admin.
    async beforeSessionCreation(ctx, { userId }) {
      const user = await ctx.db.get(userId as Id<"users">);
      if (!user?.role) {
        throw new ConvexError("Este e-mail ainda não tem acesso. Fale com o estúdio.");
      }
    },
  },
});
