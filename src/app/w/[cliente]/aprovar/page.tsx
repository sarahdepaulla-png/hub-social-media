"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { Asterisk, Loading, Thumb } from "@/components/brand";
import { useWorkspace } from "@/components/WorkspaceShell";
import { longDate } from "@/lib/dates";
import { FORMAT } from "@/lib/labels";

const firstUpper = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export default function AprovarPage() {
  const ws = useWorkspace();
  const data = useQuery(api.approvals.list, { slug: ws.slug });
  if (data === undefined) return <Loading />;
  const { items, isAdmin } = data;
  const n = items.length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 pb-16 pt-4 md:px-6">
      <header className="flex flex-col gap-3">
        <h1 className="titulo flex items-center gap-3 text-5xl md:text-7xl">
          Para aprovar <Asterisk size={40} color="var(--color-rosa)" />
        </h1>
        <p className="text-base text-texto-2">
          {n === 0
            ? "Nada esperando aprovação agora. Tudo em dia."
            : isAdmin
              ? `${n} ${n === 1 ? "peça esperando" : "peças esperando"} a decisão de ${ws.name}.`
              : `${n === 1 ? "Tem 1 conteúdo esperando" : `Tem ${n} conteúdos esperando`} você. Toque em cada um para ver, escolher a legenda e aprovar ou pedir ajuste.`}
        </p>
        {isAdmin && <SendBar slug={ws.slug} name={ws.name} count={n} whatsapp={data.whatsapp} people={data.people} />}
      </header>

      {n > 0 && (
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c, i) => (
            <li key={c._id}>
              <Link href={`/w/${ws.slug}/c/${c._id}`} className="group flex h-full gap-4 rounded-peca bg-white p-3 hover:bg-[#FFF6FA]">
                <Thumb url={c.coverUrl} tone={i} label={c.coverUrl ? undefined : FORMAT[c.format]} className="h-[150px] w-[120px] shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
                  <span className="text-[13px] font-semibold text-texto-2">
                    {firstUpper(longDate(c.date))}
                    {c.time ? `, ${c.time}` : ""}
                  </span>
                  <strong className="line-clamp-2 text-[17px] leading-tight group-hover:underline">{c.title}</strong>
                  <span className="text-[13px] text-texto-2">
                    {FORMAT[c.format]}
                    {c.cards > 1 ? `, ${c.cards} cards` : ""}
                    {c.captionOptions > 1 ? `, ${c.captionOptions} opções de legenda` : ""}
                  </span>
                  {c.caption && <span className="line-clamp-2 text-[13px] leading-snug text-texto-3">{c.caption}</span>}
                  <span className="mt-auto inline-flex min-h-10 items-center self-start rounded-full bg-vinho px-4 text-sm font-bold text-white">
                    Ver e aprovar
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

/** Só a admin: manda a página no WhatsApp com a mensagem pronta e o link que já entra direto. */
function SendBar({
  slug,
  name,
  count,
  whatsapp,
  people,
}: {
  slug: string;
  name: string;
  count: number;
  whatsapp: string | null;
  people: { name: string; token: string }[];
}) {
  const [who, setWho] = useState(0);
  const [copied, setCopied] = useState(false);
  const person = people[who] ?? null;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const page = `/w/${slug}/aprovar`;
  // Link pessoal: a cliente entra sem código e cai direto nesta página.
  const link = person ? `${origin}/acesso/${person.token}?ir=${encodeURIComponent(page)}` : `${origin}${page}`;
  const first = (person?.name ?? name).split(" ")[0];
  const message =
    count === 0
      ? `Oi, ${first}! Por aqui está tudo aprovado. Quando tiver conteúdo novo, ele aparece neste link: ${link}`
      : `Oi, ${first}! ${count === 1 ? "Tem 1 conteúdo novo esperando" : `Tem ${count} conteúdos novos esperando`} a sua aprovação no Hub.\n\nÉ só abrir o link, ver cada peça e aprovar ou pedir ajuste:\n${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sem permissão de cópia */
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-peca bg-white p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <a
          href={`https://wa.me/${whatsapp ?? ""}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1F8F4E] px-5 text-sm font-bold text-white hover:bg-[#187540]"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px] fill-current">
            <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.8 11.9 11.9 0 004.6 4c1.7.7 2.4.8 3.2.6a2.8 2.8 0 001.8-1.3 2.3 2.3 0 00.2-1.3c-.1-.1-.3-.2-.5-.3z" />
          </svg>
          Enviar no WhatsApp
        </a>
        <button type="button" onClick={() => void copy()} className="min-h-11 rounded-full border-[1.5px] border-vinho px-4 text-sm font-semibold hover:bg-creme">
          {copied ? "Mensagem copiada" : "Copiar mensagem"}
        </button>
        {people.length > 1 && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            Para
            <select value={who} onChange={(e) => setWho(Number(e.target.value))} className="min-h-11 border border-campo bg-white px-3 text-[15px] font-normal">
              {people.map((p, i) => (
                <option key={p.token} value={i}>{p.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="whitespace-pre-wrap rounded-xl bg-creme p-3 text-sm leading-relaxed text-texto-3">{message}</p>
      <p className="text-xs text-texto-2">
        {person
          ? `O link é o acesso pessoal de ${person.name}: entra direto, sem código. Mande só para ela.`
          : "Esta cliente ainda não tem acesso pessoal. Crie em Clientes e acessos para o link entrar sem código."}
        {!whatsapp && " Sem WhatsApp cadastrado: o WhatsApp abre para você escolher o contato."}
      </p>
    </div>
  );
}
