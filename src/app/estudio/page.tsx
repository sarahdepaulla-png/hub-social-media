"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Avatar, Loading } from "@/components/brand";
import { currentMonth, longDate, monthName, shortDate, todayISO } from "@/lib/dates";
import { STATUS } from "@/lib/labels";

export default function EstudioPage() {
  const month = currentMonth();
  const today = todayISO();
  const clients = useQuery(api.clients.listForStudio, { month, today });
  const inbox = useQuery(api.dashboard.studioInbox, {});

  if (clients === undefined || inbox === undefined) return <Loading />;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-14 px-6 py-12">
      <header className="flex flex-col gap-2">
        <span className="text-[15px] capitalize text-texto-2">{longDate(today)}</span>
        <h1 className="titulo text-6xl md:text-7xl">Estúdio</h1>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-[28px] font-extrabold tracking-[-0.045em]">Precisa de você</h2>
        {inbox.length === 0 ? (
          <p className="text-base text-texto-2">Nenhum ajuste pedido e nenhuma ideia nova. Bom momento para produzir.</p>
        ) : (
          <ul className="flex flex-col border-t border-linha">
            {inbox.map((item, i) => (
              <li key={i} className="border-b border-linha">
                <Link
                  href={item.contentId ? `/w/${item.clientSlug}/c/${item.contentId}` : `/w/${item.clientSlug}/ideias`}
                  className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-4 py-4"
                >
                  <span aria-hidden="true" className="size-3 rounded-full" style={{ background: item.accentColor }} />
                  <span className="flex min-w-0 flex-col gap-1">
                    <strong className="text-base">
                      {item.kind === "ajuste" ? `${item.clientName} pediu ajuste: ${item.title}` : `${item.clientName}: ${item.title}`}
                    </strong>
                    {item.detail && <span className="truncate text-sm text-texto-2">{item.detail}</span>}
                  </span>
                  <span className="text-sm font-semibold text-rosa-forte">{item.kind === "ajuste" ? "Abrir" : "Ver ideias"}</span>
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
            <li key={c._id} className="border-b border-linha">
              <Link
                href={`/w/${c.slug}`}
                className="grid gap-4 py-5 md:grid-cols-[200px_minmax(0,1fr)_220px] md:items-center md:gap-6"
              >
                <span className="flex items-center gap-3">
                  <Avatar name={c.name} color={c.accentColor} url={c.photoUrl} size={42} />
                  <span className="flex flex-col">
                    <strong className="text-[17px]">{c.name}</strong>
                    <span className="text-[13px] text-texto-2">{c.counts.total} conteúdos</span>
                  </span>
                </span>
                <span className="flex gap-1.5 overflow-hidden" aria-label="Conteúdos do mês por status">
                  {c.strip.length === 0 ? (
                    <span className="text-sm text-texto-2">Mês ainda vazio</span>
                  ) : (
                    c.strip.map((s, i) => (
                      <span
                        key={s._id}
                        title={`${shortDate(s.date)}: ${STATUS[s.status].label}`}
                        className={`h-[60px] w-12 shrink-0 rounded-lg ${["bg-thumb", "bg-thumb-2", "bg-thumb-3"][i % 3]}`}
                        style={{ boxShadow: `inset 0 -4px 0 ${STATUS[s.status].color}` }}
                      />
                    ))
                  )}
                </span>
                <span className="flex flex-col gap-1 text-sm">
                  <span className={c.counts.ajuste > 0 ? "font-bold text-st-ajuste-texto" : ""}>
                    {c.counts.aguardando} aguardando{c.counts.ajuste > 0 ? `, ${c.counts.ajuste} em ajuste` : ""}
                  </span>
                  <span className="text-texto-2">{c.nextDate ? `Próximo: ${shortDate(c.nextDate)}` : "Sem próximas datas"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
