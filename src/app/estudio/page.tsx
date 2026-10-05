"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Avatar, Loading, Thumb } from "@/components/brand";
import { AutoCovers } from "@/components/AutoCovers";
import { StatusMenu } from "@/components/StatusMenu";
import { PieceDrawer } from "@/components/PieceDrawer";
import type { Id } from "@convex/_generated/dataModel";
import { useState } from "react";
import { currentMonth, longDate, monthName, shortDate, todayISO } from "@/lib/dates";

export default function EstudioPage() {
  const month = currentMonth();
  const today = todayISO();
  const clients = useQuery(api.clients.listForStudio, { month, today });
  const inbox = useQuery(api.dashboard.studioInbox, {});
  const [open, setOpen] = useState<{ id: Id<"contents">; slug: string } | null>(null);

  if (clients === undefined || inbox === undefined) return <Loading />;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-14 px-6 py-12">
      <AutoCovers />
      <header className="flex flex-col gap-2">
        <span className="text-[15px] capitalize text-texto-2">{longDate(today)}</span>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="titulo text-6xl md:text-7xl">Estúdio</h1>
          <Link href="/estudio/esteira" className="inline-flex min-h-11 items-center rounded-full bg-vinho px-5 text-sm font-semibold text-white">
            Abrir a esteira
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-[28px] font-extrabold tracking-[-0.045em]">Precisa de você</h2>
        {inbox.length === 0 ? (
          <p className="text-base text-texto-2">Nenhum ajuste pedido, briefing ou ideia nova. Bom momento para produzir.</p>
        ) : (
          <ul className="flex flex-col border-t border-linha">
            {inbox.map((item, i) => (
              <li key={i} className="border-b border-linha">
                <Link
                  href={
                    item.contentId
                      ? `/w/${item.clientSlug}/c/${item.contentId}`
                      : item.briefingId
                        ? `/w/${item.clientSlug}/briefing/${item.briefingId}`
                        : `/w/${item.clientSlug}/ideias`
                  }
                  onClick={(e) => {
                    if (!item.contentId) return;
                    e.preventDefault();
                    setOpen({ id: item.contentId as Id<"contents">, slug: item.clientSlug });
                  }}
                  className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-4 py-3.5"
                >
                  {item.kind === "ajuste" ? (
                    <Thumb url={item.coverUrl} tone={i} className="h-[70px] w-14 outline outline-2 outline-offset-2 outline-st-ajuste" />
                  ) : item.kind === "briefing" ? (
                    <span aria-hidden="true" className="flex h-[70px] w-14 flex-col items-center justify-center gap-1 rounded-peca bg-rosa text-[10px] font-bold uppercase tracking-wide text-vinho">
                      <span className="size-2.5 rounded-full" style={{ background: item.accentColor }} />
                      Brief
                    </span>
                  ) : (
                    <span aria-hidden="true" className="flex h-[70px] w-14 items-center justify-center rounded-peca border border-dashed border-campo">
                      <span className="size-3 rounded-full" style={{ background: item.accentColor }} />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-col gap-1">
                    <strong className="text-base">
                      {item.kind === "ajuste"
                        ? `${item.clientName} pediu ajuste: ${item.title}`
                        : item.kind === "briefing"
                          ? `${item.clientName} mandou um briefing: ${item.title}`
                          : `${item.clientName}: ${item.title}`}
                    </strong>
                    {item.detail && <span className="truncate text-sm text-texto-2">{item.detail}</span>}
                  </span>
                  <span className="text-sm font-semibold text-rosa-forte">{item.kind === "ajuste" ? "Abrir" : item.kind === "briefing" ? "Ler" : "Ver ideias"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-[28px] font-extrabold tracking-[-0.045em]">{monthName(month)} por cliente</h2>
        <ul className="flex flex-col border-t border-linha">
          {clients.map((c) => (
            <li key={c._id} className="flex flex-col gap-3 border-b border-linha py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href={`/w/${c.slug}`} className="flex items-center gap-3">
                  <Avatar name={c.name} color={c.accentColor} url={c.photoUrl} size={42} />
                  <span className="flex flex-col">
                    <strong className="text-[17px]">{c.name}</strong>
                    <span className="text-[13px] text-texto-2">
                      {c.counts.total} conteúdos ·{" "}
                      <strong className="text-vinho">{c.counts.publicados} {c.counts.publicados === 1 ? "postado" : "postados"}</strong>
                    </span>
                  </span>
                </Link>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className={c.counts.ajuste > 0 ? "font-bold text-st-ajuste-texto" : ""}>
                    {c.counts.aguardando} aguardando{c.counts.ajuste > 0 ? `, ${c.counts.ajuste} em ajuste` : ""}
                  </span>
                  <span className="text-texto-2">{c.nextDate ? `Próximo: ${shortDate(c.nextDate)}` : "Sem próximas datas"}</span>
                  {c.newBriefings > 0 && (
                    <Link href="/estudio/esteira" className="rounded-full bg-vinho px-3 py-1 font-semibold text-white">
                      {c.newBriefings === 1 ? "1 briefing" : `${c.newBriefings} briefings`}
                    </Link>
                  )}
                  {c.newIdeas > 0 && (
                    <Link href={`/w/${c.slug}/ideias`} className="rounded-full bg-rosa px-3 py-1 font-semibold text-vinho">
                      {c.newIdeas === 1 ? "1 ideia nova" : `${c.newIdeas} ideias novas`}
                    </Link>
                  )}
                  <Link href={`/w/${c.slug}/ideias`} className="font-semibold text-rosa-forte">Ideias</Link>
                  <Link href={`/w/${c.slug}/calendario`} className="font-semibold text-rosa-forte">Calendário</Link>
                </span>
              </div>
              {c.strip.length === 0 ? (
                <span className="text-sm text-texto-2">Mês ainda vazio</span>
              ) : (
                <ul className="flex snap-x gap-2.5 overflow-x-auto pb-1" aria-label={`Conteúdos de ${c.name} no mês`}>
                  {c.strip.map((s, i) => (
                    <li key={s._id} className="flex w-[92px] shrink-0 snap-start flex-col gap-1.5">
                      <button type="button" onClick={() => setOpen({ id: s._id, slug: c.slug })} className="group flex flex-col gap-1.5 text-left" title={s.title}>
                        <Thumb
                          url={s.coverUrl}
                          tone={i}
                          className="aspect-[4/5] w-full transition-transform duration-150 group-hover:-rotate-1"
                        />
                        <span className="text-[11px] text-texto-2">{shortDate(s.date)}</span>
                      </button>
                      <StatusMenu contentId={s._id} status={s.status} editable short className="text-[11px]" />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>
      {open && <PieceDrawer key={open.id} contentId={open.id} slug={open.slug} onClose={() => setOpen(null)} />}
    </main>
  );
}
