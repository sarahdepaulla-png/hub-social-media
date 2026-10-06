import Resend from "@auth/core/providers/resend";
import { ConvexError } from "convex/values";
import type { GenericActionCtx, GenericDataModel } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Login sem senha: código de 6 dígitos por e-mail.
 * Funciona dentro do navegador do WhatsApp, onde link mágico costuma
 * abrir em outra aba e perder a sessão.
 */

function sixDigits(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1_000_000).padStart(6, "0");
}

export const EmailOTP = Resend({
  id: "email-otp",
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: 60 * 15,
  async generateVerificationToken() {
    return sixDigits();
  },
  // O Convex Auth passa o ctx como segundo argumento.
  async sendVerificationRequest({ identifier: email, token, provider }, ctx?: GenericActionCtx<GenericDataModel>) {
    // Caminho principal: o código sai pelo Gmail da Sarah (senha de app).
    if (ctx && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      const allowed = await ctx.runQuery(internal.invites.canSignIn, { email });
      if (!allowed) throw new ConvexError("Este e-mail ainda não tem acesso. Fale com o estúdio.");
      await ctx.runAction(internal.mailer.sendCode, { email, code: token });
      return;
    }
    // Sem e-mail configurado (desenvolvimento local): o código aparece nos logs do Convex.
    if (!provider.apiKey) {
      console.log(`[Hub] Código de acesso para ${email}: ${token}`);
      return;
    }
    const from = process.env.AUTH_EMAIL_FROM ?? "Hub Social Media <onboarding@resend.dev>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Seu código: ${token}`,
        text: `Seu código de acesso ao Hub Social Media é ${token}.\n\nEle vale por 15 minutos. Se não foi você, ignore este e-mail.`,
      }),
    });
    if (!res.ok) {
      throw new Error(`Não foi possível enviar o código (${res.status}).`);
    }
  },
});
