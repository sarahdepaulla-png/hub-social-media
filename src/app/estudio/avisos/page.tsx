"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import { Asterisk, Avatar, Loading } from "@/components/brand";
import { stamp } from "@/lib/dates";

const KIND: Record<string, { label: string; color: string }> = {
  entrada: { label: "Entrou", color: "#2B6CB0" },
  decisao: { label: "Decisão", color: "#C2186B" },
  plano: { label: "Plano", color: "#5C0F31" },
  comentario: { label: "Comentário", color: "#8A63D2" },
  legenda: { label: "Legenda", color: "#0F7A6E" },
  edicao: { label: "Edição", color: "#B8691C" },
  midia: { label: "Mídia", color: "#B8691C" },
  ideia: { label: "Ideia", color: "#0F7A6E" },
  briefing: { label: "Briefing", color: "#0F7A6E" },
  status: { label: "Status", color: "#7A4A5E" },
};

function ago(ts: number, now: number) {
  const min = Math.round((now - ts) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return stamp(ts);
}

/** Frase com sujeito: "Bia aprovou a versão 1", "Mai pediu ajuste na versão 2". */
function phrase(summary: string) {
  const s = summary
    .replace(/^Aprovado com observação na versão/, "Aprovou com observação a versão")
    .replace(/^Aprovado na versão/, "Aprovou a versão")
    .replace(/^Ajuste solicitado na versão/, "Pediu ajuste na versão")
    .replace(/^Desfez "Aprovado com observação"/, "Desfez a aprovação com observação")
    .replace(/^Desfez "Aprovado"/, "Desfez a aprovação")
    .replace(/^Desfez "Ajuste solicitado"/, "Desfez o pedido de ajuste");
  return s.charAt(0).toLowerCase() + s.slice(1);
}

type Client = NonNullable<ReturnType<typeof useQuery<typeof api.presence.feed>>>["clients"][number];

function ClientCard({ c, now }: { c: Client; now: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? c.items : c.items.slice(0, 5);
  return (
    <article className="flex flex-col gap-4 rounded-[22px] bg-white p-5">
      <header className="flex items-center gap-3">
        <Avatar name={c.name} color={c.accentColor} url={c.photoUrl} size={52} />
        <span className="flex min-w-0 flex-1 flex-col">
          <Link href={`/w/${c.slug}`} className="text-xl font-extrabold tracking-tight hover:underline">
            {c.name}
          </Link>
          <span className="text-[13px] text-texto-2">
            {c.people.some((p) => p.online) ? "Online agora" : c.items[0] ? `Último movimento ${ago(c.items[0].at, now)}` : "Sem movimentos ainda"}
          </span>
        </span>
        {c.unread > 0 && <span className="rounded-full bg-rosa-forte px-2.5 text-xs font-bold leading-6 text-white">{c.unread} novo{c.unread > 1 ? "s" : ""}</span>}
      </header>

      {c.people.length > 0 && (
        <ul className="flex flex-col gap-2 rounded-2xl bg-creme p-3">
          {c.people.map((p) => (
            <li key={p._id} className="flex items-start gap-2.5">
              <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${p.online ? "bg-[#1F8F4E]" : "bg-campo"}`} />
              <span className="flex min-w-0 flex-col">
                <span className="text-[15px] font-semibold">
                  {p.name}
                  <span className={`ml-2 text-[13px] font-normal ${p.online ? "font-semibold text-[#1F8F4E]" : "text-texto-2"}`}>{p.online ? "online agora" : "offline"}</span>
                </span>
                <span className="text-[13px] text-texto-2">
                  {p.lastEntryAt ? `Última vez que entrou: ${stamp(p.lastEntryAt)}` : "Ainda não entrou desde que o aviso foi ligado"}
                  {!p.online && p.lastSeenAt ? ` · visto ${ago(p.lastSeenAt, now)}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {c.items.length === 0 ? (
        <p className="text-sm text-texto-2">Nenhum movimento ainda.</p>
      ) : (
        <ol className="flex flex-col">
          {shown.map((it) => {
            const k = KIND[it.kind] ?? { label: "Movimento", color: "#7A4A5E" };
            const text = phrase(it.summary);
            return (
              <li key={it._id} className={`flex flex-col gap-1 border-t border-linha py-2.5 first:border-t-0 ${it.unread ? "-mx-2 rounded-xl bg-[#FFF6FA] px-2" : ""}`}>
                <span className="text-[14px] leading-snug">
                  <strong>{it.who}</strong> {text}
                  {it.content && (
                    <>
                      {" em "}
                      <Link href={`/w/${c.slug}/c/${it.content._id}`} className="font-semibold text-rosa-forte underline">
                        {it.content.title}
                      </Link>
                    </>
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-texto-2">
                  <span className="rounded-full px-2 font-bold leading-5 text-white" style={{ background: k.color }}>
                    {k.label}
                  </span>
                  {ago(it.at, now)}
                  {it.unread && <span className="font-bold text-rosa-forte">Novo</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {c.items.length > 5 && (
        <button type="button" onClick={() => setAll(!all)} className="min-h-10 self-start text-sm font-semibold text-rosa-forte">
          {all ? "Mostrar menos" : `Ver todos (${c.items.length})`}
        </button>
      )}
    </article>
  );
}

/** Avisos: por cliente, quem está online, quando entrou e tudo o que fez no Hub. */
export default function AvisosPage() {
  const data = useQuery(api.presence.feed);
  const markSeen = useMutation(api.presence.markSeen);
  const marked = useRef(false);

  useEffect(() => {
    if (data && !marked.current) {
      marked.current = true;
      void markSeen({});
    }
  }, [data, markSeen]);

  if (data === undefined) return <Loading />;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="titulo flex items-center gap-3 text-6xl md:text-7xl">
          Avisos <Asterisk size={40} color="var(--color-rosa)" />
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-texto-3">Cada cliente com quem está online, a última vez que entrou e tudo o que fez no Hub.</p>
      </header>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {data.clients.map((c) => (
          <ClientCard key={c.slug} c={c} now={data.now} />
        ))}
      </div>
    </main>
  );
}
