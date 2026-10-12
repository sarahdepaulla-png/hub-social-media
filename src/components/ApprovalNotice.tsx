"use client";

import { shortDate, stamp } from "@/lib/dates";

type Notice = { sendAt: number; sentAt: number | null; sentTo: string[]; error: string | null } | null;

/** Mensagem pronta para a cliente, aberta no WhatsApp (o envio é um toque seu). */
export function whatsappLink({ phone, title, date, slug, contentId }: { phone: string | null; title: string; date: string; slug: string; contentId: string }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const text = `Oi! Tem conteúdo novo esperando sua aprovação no Hub: "${title}" (${shortDate(date)}).\n\nÉ só abrir: ${origin}/w/${slug}/c/${contentId}`;
  return `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(text)}`;
}

/** Peça em aprovação: botão do WhatsApp e situação do e-mail automático. */
export function ApprovalNotice({
  phone,
  title,
  date,
  slug,
  contentId,
  notice,
}: {
  phone: string | null;
  title: string;
  date: string;
  slug: string;
  contentId: string;
  notice: Notice;
}) {
  const mail = !notice
    ? null
    : notice.sentAt
      ? `Aviso por e-mail enviado ${stamp(notice.sentAt)} para ${notice.sentTo.join(", ")}.`
      : notice.error
        ? `E-mail não saiu: ${notice.error}`
        : "O aviso por e-mail sai em até 3 minutos.";
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[#FFF6FA] p-3">
      <a
        href={whatsappLink({ phone, title, date, slug, contentId })}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-[#1F8F4E] px-5 text-sm font-bold text-white hover:bg-[#187540]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px] fill-current">
          <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.8 11.9 11.9 0 004.6 4c1.7.7 2.4.8 3.2.6a2.8 2.8 0 001.8-1.3 2.3 2.3 0 00.2-1.3c-.1-.1-.3-.2-.5-.3z" />
        </svg>
        Avisar no WhatsApp
      </a>
      {!phone && <span className="text-xs text-texto-2">Sem WhatsApp cadastrado: o WhatsApp abre para você escolher o contato. Cadastre em Clientes e acessos.</span>}
      {mail && <span className={`text-xs ${notice?.error ? "font-semibold text-st-ajuste-texto" : "text-texto-2"}`}>{mail}</span>}
    </div>
  );
}
