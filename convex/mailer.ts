"use node";

import nodemailer from "nodemailer";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Convite por e-mail, enviado pelo Gmail da Sarah (senha de app do Google).
 * Não precisa de domínio: o e-mail sai do próprio Gmail dela.
 */

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function inviteEmail({ name, clientName, link, from }: { name: string | null; clientName: string | null; link: string; from: string }) {
  const hi = name ? `Oi, ${name}!` : "Oi!";
  const where = "o seu espaço";
  const subject = clientName ? `Seu planejamento de conteúdo, ${clientName}` : "Seu acesso ao Hub Social Media";
  const text = [
    hi,
    "",
    `${from} abriu ${where} no Hub Social Media. É lá que você vê o calendário, aprova os conteúdos, escolhe legendas e manda ideias.`,
    "",
    "Para entrar, é só abrir este link:",
    link,
    "",
    "Ele é só seu e entra direto, sem senha. Não encaminhe para ninguém.",
  ].join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f8ece6;font-family:Helvetica,Arial,sans-serif;color:#5c0f31">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8ece6;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#ff8dc7;padding:28px 28px 22px">
<div style="font-size:13px;font-weight:700;letter-spacing:.02em;color:#5c0f31">HUB SOCIAL MEDIA</div>
<div style="font-size:40px;line-height:1;font-weight:800;letter-spacing:-.04em;color:#ffffff;margin-top:14px">Seu espaço<br>está pronto *</div>
</td></tr>
<tr><td style="padding:26px 28px 8px;font-size:16px;line-height:1.55">
<p style="margin:0 0 14px;font-weight:700">${escape(hi)}</p>
<p style="margin:0 0 14px">${escape(from)} abriu ${escape(where)} no Hub Social Media. É lá que você vê o calendário, aprova os conteúdos, escolhe legendas e manda ideias.</p>
</td></tr>
<tr><td style="padding:8px 28px 26px">
<a href="${link}" style="display:inline-block;background:#5c0f31;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:999px">Entrar no meu espaço</a>
</td></tr>
<tr><td style="padding:0 28px 28px;font-size:13px;line-height:1.5;color:#7a4a5e">
O link é só seu e entra direto, sem senha. Não encaminhe para ninguém.<br>
Se o botão não abrir, copie: <a href="${link}" style="color:#c2186b;word-break:break-all">${link}</a>
</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

function gmail() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) return null;
  return { user, transport: nodemailer.createTransport({ service: "gmail", auth: { user, pass } }) };
}

export function codeEmail(code: string) {
  const subject = `Seu código de acesso: ${code}`;
  const text = `Seu código de acesso ao Hub Social Media é ${code}.\n\nEle vale por 15 minutos. Se não foi você que pediu, pode ignorar este e-mail.`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f8ece6;font-family:Helvetica,Arial,sans-serif;color:#5c0f31">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8ece6;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#ff8dc7;padding:24px 28px">
<div style="font-size:13px;font-weight:700;letter-spacing:.02em;color:#5c0f31">HUB SOCIAL MEDIA</div>
<div style="font-size:34px;line-height:1;font-weight:800;letter-spacing:-.04em;color:#ffffff;margin-top:12px">Seu código *</div>
</td></tr>
<tr><td style="padding:26px 28px 6px;font-size:16px;line-height:1.5">Digite este código na tela de entrada do Hub:</td></tr>
<tr><td style="padding:10px 28px 18px"><div style="display:inline-block;background:#f8ece6;border-radius:12px;padding:14px 22px;font-size:38px;font-weight:800;letter-spacing:.18em;color:#5c0f31">${code}</div></td></tr>
<tr><td style="padding:0 28px 28px;font-size:13px;line-height:1.5;color:#7a4a5e">Ele vale por 15 minutos. Se não foi você que pediu, pode ignorar este e-mail.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

/** Código de 6 números para entrar pelo e-mail (tela Entrar). */
export const sendCode = internalAction({
  args: { email: v.string(), code: v.string() },
  handler: async (_ctx, { email, code }) => {
    const mail = gmail();
    if (!mail) throw new Error("E-mail não configurado.");
    const { subject, text, html } = codeEmail(code);
    await mail.transport.sendMail({
      from: { name: process.env.MAIL_FROM_NAME || "Hub Social Media", address: mail.user },
      to: email,
      subject,
      text,
      html,
    });
  },
});

export const sendInvite = internalAction({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, { inviteId }) => {
    const data = await ctx.runQuery(internal.invites.forEmail, { inviteId });
    if (!data) return;
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
    const site = process.env.SITE_URL;
    if (!user || !pass || !site) {
      await ctx.runMutation(internal.invites.markEmail, { inviteId, error: "E-mail ainda não configurado (falta a senha de app do Gmail na Vercel)." });
      return;
    }
    const fromName = process.env.MAIL_FROM_NAME || data.adminName || "Hub Social Media";
    const link = `${site.replace(/\/$/, "")}/acesso/${data.token}`;
    const { subject, text, html } = inviteEmail({ name: data.name, clientName: data.clientName, link, from: fromName });
    try {
      const transport = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
      await transport.sendMail({ from: { name: fromName, address: user }, to: data.email, replyTo: user, subject, text, html });
      await ctx.runMutation(internal.invites.markEmail, { inviteId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const friendly = /Invalid login|Username and Password not accepted|535/i.test(msg)
        ? "O Gmail recusou a senha de app. Confira GMAIL_USER e GMAIL_APP_PASSWORD na Vercel."
        : `Não deu para enviar: ${msg.slice(0, 160)}`;
      await ctx.runMutation(internal.invites.markEmail, { inviteId, error: friendly });
    }
  },
});

const FORMAT_LABEL: Record<string, string> = { carrossel: "Carrossel", reels: "Reels", stories: "Stories", imagem: "Post", video: "Vídeo" };

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function approvalEmail({
  name,
  clientName,
  from,
  pieces,
  link,
}: {
  name: string | null;
  clientName: string;
  from: string;
  pieces: { title: string; date: string; format: string }[];
  link: string;
}) {
  const hi = name ? `Oi, ${name.split(" ")[0]}!` : "Oi!";
  const one = pieces.length === 1;
  const subject = one ? `Conteúdo para aprovar: ${pieces[0].title}` : `${pieces.length} conteúdos para aprovar, ${clientName}`;
  const lead = one ? "Tem um conteúdo novo esperando a sua aprovação no Hub." : `Tem ${pieces.length} conteúdos novos esperando a sua aprovação no Hub.`;
  const lines = pieces.map((p) => `${shortDate(p.date)}  ${p.title} (${FORMAT_LABEL[p.format] ?? p.format})`);
  const text = [hi, "", lead, "", ...lines, "", "Para ver e aprovar:", link, "", `${from}`].join("\n");
  const rows = pieces
    .map(
      (p) => `<tr><td style="padding:10px 0;border-top:1px solid #f3dbe6;font-size:15px">
<span style="display:inline-block;min-width:48px;font-weight:700">${shortDate(p.date)}</span>${escape(p.title)}
<span style="color:#7a4a5e"> · ${escape(FORMAT_LABEL[p.format] ?? p.format)}</span></td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f8ece6;font-family:Helvetica,Arial,sans-serif;color:#5c0f31">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8ece6;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#ff8dc7;padding:28px 28px 22px">
<div style="font-size:13px;font-weight:700;letter-spacing:.02em;color:#5c0f31">HUB SOCIAL MEDIA</div>
<div style="font-size:40px;line-height:1;font-weight:800;letter-spacing:-.04em;color:#ffffff;margin-top:14px">${one ? "Tem conteúdo<br>para aprovar *" : `${pieces.length} conteúdos<br>para aprovar *`}</div>
</td></tr>
<tr><td style="padding:26px 28px 6px;font-size:16px;line-height:1.55">
<p style="margin:0 0 12px;font-weight:700">${escape(hi)}</p>
<p style="margin:0 0 8px">${escape(lead)}</p>
</td></tr>
<tr><td style="padding:0 28px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
<tr><td style="padding:16px 28px 26px">
<a href="${link}" style="display:inline-block;background:#5c0f31;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:999px">${one ? "Ver e aprovar" : "Ver os conteúdos"}</a>
</td></tr>
<tr><td style="padding:0 28px 28px;font-size:13px;line-height:1.5;color:#7a4a5e">
Enviado por ${escape(from)} pelo Hub Social Media.<br>
Se o botão não abrir, copie: <a href="${link}" style="color:#c2186b;word-break:break-all">${link}</a>
</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

/** Manda o aviso de aprovação para cada pessoa da cliente (um e-mail por pessoa, com o link dela). */
export const sendApproval = internalAction({
  args: { noticeId: v.id("approvalNotices") },
  handler: async (ctx, { noticeId }) => {
    const data = await ctx.runQuery(internal.notify.noticeData, { noticeId });
    if (!data) return;
    if (data.pieces.length === 0) {
      await ctx.runMutation(internal.notify.markNotice, { noticeId, error: "As peças saíram de aprovação antes do envio." });
      return;
    }
    if (data.recipients.length === 0) {
      await ctx.runMutation(internal.notify.markNotice, { noticeId, error: "A cliente ainda não tem e-mail cadastrado no Hub." });
      return;
    }
    const mail = gmail();
    const site = process.env.SITE_URL?.replace(/\/$/, "");
    if (!mail || !site) {
      await ctx.runMutation(internal.notify.markNotice, { noticeId, error: "E-mail não configurado (falta a senha de app do Gmail na Vercel)." });
      return;
    }
    const fromName = process.env.MAIL_FROM_NAME || data.adminName || "Hub Social Media";
    const target = data.pieces.length === 1 ? `/w/${data.client.slug}/c/${data.pieces[0]._id}` : `/w/${data.client.slug}/aprovar`;
    const sent: string[] = [];
    const failed: string[] = [];
    for (const r of data.recipients) {
      // Quem tem link pessoal entra direto, sem código.
      const link = r.token ? `${site}/acesso/${r.token}?ir=${encodeURIComponent(target)}` : `${site}${target}`;
      const { subject, text, html } = approvalEmail({ name: data.recipients.length > 1 ? r.name : data.client.name, clientName: data.client.name, from: fromName, pieces: data.pieces, link });
      try {
        await mail.transport.sendMail({ from: { name: fromName, address: mail.user }, to: r.email, replyTo: mail.user, subject, text, html });
        sent.push(r.email);
      } catch (err) {
        failed.push(`${r.email}: ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`);
      }
    }
    if (sent.length) await ctx.runMutation(internal.notify.markNotice, { noticeId, sentTo: sent });
    else await ctx.runMutation(internal.notify.markNotice, { noticeId, error: `Não deu para enviar. ${failed.join("; ")}` });
  },
});

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function planDecisionEmail({ clientName, month, theme, approved, who, comment, promoted, link }: {
  clientName: string; month: string; theme: string; approved: boolean; who: string; comment?: string; promoted: number; link: string;
}) {
  const monthLabel = MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
  const subject = approved ? `${clientName} aprovou o plano de ${monthLabel}` : `${clientName} pediu ajuste no plano de ${monthLabel}`;
  const lines = [
    approved ? `${who} aprovou o plano de ${monthLabel} da ${clientName}: "${theme}".` : `${who} pediu ajuste no plano de ${monthLabel} da ${clientName}: "${theme}".`,
    comment ? `\nComentário: "${comment}"` : "",
    approved && promoted ? `\n${promoted === 1 ? "1 post entrou" : `${promoted} posts entraram`} no calendário de ${monthLabel} como Em produção.` : "",
    "",
    `Abrir o plano: ${link}`,
  ];
  const text = lines.filter((l, i) => l || i === 3).join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f8ece6;font-family:Helvetica,Arial,sans-serif;color:#5c0f31">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8ece6;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:${approved ? "#ff8dc7" : "#e5482e"};padding:24px 28px">
<div style="font-size:13px;font-weight:700;letter-spacing:.02em;color:#5c0f31">HUB SOCIAL MEDIA</div>
<div style="font-size:34px;line-height:1.02;font-weight:800;letter-spacing:-.04em;color:#ffffff;margin-top:12px">${approved ? "Plano aprovado *" : "Ajuste no plano"}</div>
</td></tr>
<tr><td style="padding:24px 28px 6px;font-size:16px;line-height:1.55">
<p style="margin:0 0 12px"><strong>${escape(who)}</strong> ${approved ? "aprovou" : "pediu ajuste n"}o plano de ${monthLabel} da ${escape(clientName)}.</p>
<p style="margin:0 0 12px;font-size:20px;font-weight:800;letter-spacing:-.02em">${escape(theme)}</p>
${comment ? `<p style="margin:0 0 12px;background:#f8ece6;border-radius:12px;padding:12px 14px">&ldquo;${escape(comment)}&rdquo;</p>` : ""}
${approved && promoted ? `<p style="margin:0 0 12px">${promoted === 1 ? "1 post entrou" : `${promoted} posts entraram`} no calendário de ${monthLabel} como <strong>Em produção</strong>.</p>` : ""}
</td></tr>
<tr><td style="padding:8px 28px 28px"><a href="${link}" style="display:inline-block;background:#5c0f31;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:999px">Abrir o plano</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

/** Avisa o estúdio por e-mail quando a cliente aprova ou pede ajuste no plano do mês. */
export const sendPlanDecision = internalAction({
  args: { planId: v.id("monthPlans"), promoted: v.number() },
  handler: async (ctx, { planId, promoted }) => {
    const data = await ctx.runQuery(internal.plans.decisionData, { planId });
    const mail = gmail();
    const site = process.env.SITE_URL?.replace(/\/$/, "");
    if (!data || !data.decision || !mail || !site || data.to.length === 0) return;
    const { subject, text, html } = planDecisionEmail({
      clientName: data.client.name,
      month: data.month,
      theme: data.theme,
      approved: data.status === "aprovado",
      who: data.decision.name,
      comment: data.decision.comment,
      promoted,
      link: `${site}/w/${data.client.slug}/plano?mes=${data.month}`,
    });
    await mail.transport.sendMail({ from: { name: process.env.MAIL_FROM_NAME || "Hub Social Media", address: mail.user }, to: data.to, subject, text, html });
  },
});

export function planReadyEmail({ name, month, theme, count, from, link }: {
  name: string | null; month: string; theme: string; count: number; from: string; link: string;
}) {
  const monthLabel = MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
  const hi = name ? `Oi, ${name.split(" ")[0]}!` : "Oi!";
  const subject = `Seu calendário de ${monthLabel} está pronto para aprovar`;
  const posts = count === 1 ? "1 post" : `${count} posts`;
  const text = [
    hi,
    "",
    `O plano de ${monthLabel} está pronto: "${theme}".`,
    `Montei o caminho do mês, o calendário com ${posts} e como o feed vai ficar. É só abrir, dar uma olhada e aprovar ou pedir ajuste. Quando você aprova, os posts entram no calendário.`,
    "",
    link,
    "",
    "O link é só seu e entra direto, sem senha.",
  ].join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f8ece6;font-family:Helvetica,Arial,sans-serif;color:#5c0f31">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8ece6;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#ff8dc7;padding:26px 28px">
<div style="font-size:13px;font-weight:700;letter-spacing:.02em;color:#5c0f31">HUB SOCIAL MEDIA</div>
<div style="font-size:38px;line-height:1;font-weight:800;letter-spacing:-.04em;color:#ffffff;margin-top:12px">Seu ${monthLabel}<br>está pronto *</div>
</td></tr>
<tr><td style="padding:26px 28px 6px;font-size:16px;line-height:1.55">
<p style="margin:0 0 14px;font-weight:700">${escape(hi)}</p>
<p style="margin:0 0 10px">O plano de ${monthLabel} está pronto:</p>
<p style="margin:0 0 14px;font-size:22px;font-weight:800;letter-spacing:-.02em">${escape(theme)}</p>
<p style="margin:0 0 14px">Montei o caminho do mês, o calendário com ${posts} e como o feed vai ficar. É só abrir, dar uma olhada e aprovar ou pedir ajuste. Quando você aprova, os posts entram no calendário.</p>
</td></tr>
<tr><td style="padding:8px 28px 26px"><a href="${link}" style="display:inline-block;background:#5c0f31;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:999px">Ver e aprovar o plano</a></td></tr>
<tr><td style="padding:0 28px 28px;font-size:13px;line-height:1.5;color:#7a4a5e">Enviado por ${escape(from)} pelo Hub Social Media. O link é só seu e entra direto, sem senha.<br>
Se o botão não abrir, copie: <a href="${link}" style="color:#c2186b;word-break:break-all">${link}</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

/** E-mail para a cliente: o plano do mês está pronto para aprovar (um por pessoa, com o link dela). */
export const sendPlanReady = internalAction({
  args: { planId: v.id("monthPlans") },
  handler: async (ctx, { planId }) => {
    const data = await ctx.runQuery(internal.plans.readyData, { planId });
    if (!data) return;
    if (data.recipients.length === 0) {
      await ctx.runMutation(internal.plans.markReadyMail, { planId, error: "A cliente ainda não tem e-mail cadastrado no Hub." });
      return;
    }
    const mail = gmail();
    const site = process.env.SITE_URL?.replace(/\/$/, "");
    if (!mail || !site) {
      await ctx.runMutation(internal.plans.markReadyMail, { planId, error: "E-mail não configurado (falta a senha de app do Gmail na Vercel)." });
      return;
    }
    const fromName = process.env.MAIL_FROM_NAME || data.adminName || "Hub Social Media";
    const target = `/w/${data.client.slug}/plano?mes=${data.month}`;
    const sent: string[] = [];
    const failed: string[] = [];
    for (const r of data.recipients) {
      const link = r.token ? `${site}/acesso/${r.token}?ir=${encodeURIComponent(target)}` : `${site}${target}`;
      const { subject, text, html } = planReadyEmail({ name: data.recipients.length > 1 ? r.name : data.client.name, month: data.month, theme: data.theme, count: data.count, from: fromName, link });
      try {
        await mail.transport.sendMail({ from: { name: fromName, address: mail.user }, to: r.email, replyTo: mail.user, subject, text, html });
        sent.push(r.email);
      } catch (err) {
        failed.push(`${r.email}: ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`);
      }
    }
    await ctx.runMutation(internal.plans.markReadyMail, sent.length ? { planId, to: sent } : { planId, error: `Não deu para enviar. ${failed.join("; ")}` });
  },
});
