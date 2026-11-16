"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@convex/_generated/api";
import { Asterisk, Loading } from "@/components/brand";
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

function dayKey(ts: number) {
  return new Date(ts).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

/** Avisos: tudo o que as clientes fazem no Hub, quem está online e quando cada uma entrou. */
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
  const { items, people, now } = data;
  const online = people.filter((p) => p.online);
  const days: { key: string; list: typeof items }[] = [];
  for (const it of items) {
    const key = dayKey(it.at);
    const last = days.at(-1);
    if (last && last.key === key) last.list.push(it);
    else days.push({ key, list: [it] });
  }
  const today = dayKey(now);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="titulo flex items-center gap-3 text-6xl md:text-7xl">
          Avisos <Asterisk size={40} color="var(--color-rosa)" />
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-texto-3">Tudo o que as clientes fazem no Hub: aprovações, ajustes, comentários, mudanças e quando cada uma entrou.</p>
      </header>

      <section aria-labelledby="quem" className="flex flex-col gap-4">
        <div className="flex items-baseline gap-3">
          <h2 id="quem" className="text-2xl font-extrabold tracking-tight">
            Quem está por aqui
          </h2>
          <span className="text-sm text-texto-2">{online.length ? `${online.length} online agora` : "Ninguém online agora"}</span>
        </div>
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => (
            <li key={p._id} className="flex items-center gap-3 rounded-peca bg-white px-4 py-3">
              <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: p.client!.accentColor }}>
                {p.name.charAt(0).toUpperCase()}
                <span
                  aria-hidden="true"
                  className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-white ${p.online ? "bg-[#1F8F4E]" : "bg-campo"}`}
                />
              </span>
              <span className="flex min-w-0 flex-col">
                <strong className="truncate text-[15px]">
                  {p.name} <span className="font-normal text-texto-2">· {p.client!.name}</span>
                </strong>
                <span className={`text-[13px] ${p.online ? "font-semibold text-[#1F8F4E]" : "text-texto-2"}`}>
                  {p.online ? "Online agora" : p.lastSeenAt ? `Visto por último ${ago(p.lastSeenAt, now)}` : "Sem registro ainda"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="movimentos" className="flex flex-col gap-6">
        <h2 id="movimentos" className="text-2xl font-extrabold tracking-tight">
          Movimentos
        </h2>
        {items.length === 0 && <p className="rounded-peca bg-white px-5 py-6 text-base text-texto-2">Nenhum movimento das clientes ainda.</p>}
        {days.map((d) => (
          <div key={d.key} className="flex flex-col gap-2.5">
            <h3 className="text-sm font-bold uppercase tracking-[0.06em] text-texto-2">{d.key === today ? "Hoje" : d.key}</h3>
            <ol className="flex flex-col gap-2">
              {d.list.map((it) => {
                const k = KIND[it.kind] ?? { label: "Movimento", color: "#7A4A5E" };
                const text = it.summary.charAt(0).toLowerCase() + it.summary.slice(1);
                return (
                  <li key={it._id} className={`flex gap-3.5 rounded-peca px-4 py-3.5 ${it.unread ? "bg-[#FFF6FA] ring-1 ring-rosa" : "bg-white"}`}>
                    <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: it.client.accentColor }} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[15px] leading-snug">
                        <strong>{it.who}</strong> <span className="text-texto-2">({it.client.name})</span> {text}
                        {it.content && (
                          <>
                            {" em "}
                            <Link href={`/w/${it.client.slug}/c/${it.content._id}`} className="font-semibold text-rosa-forte underline">
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
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </section>
    </main>
  );
}
