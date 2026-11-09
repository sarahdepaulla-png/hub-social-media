"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Asterisk, Loading, Thumb } from "@/components/brand";
import { StatusMenu } from "@/components/StatusMenu";
import { TrashButton } from "@/components/Trash";
import { useClock } from "@/components/studio/StudioHome";
import { monthName, shortDate } from "@/lib/dates";
import { FORMAT } from "@/lib/labels";

/**
 * Arquivo: o que ficou em aberto de meses anteriores. Sai da entrada do Hub na virada do mês
 * e espera aqui: marque como postado, mude o status ou mande para a lixeira.
 */
export default function ArquivoPage() {
  const { today } = useClock();
  const items = useQuery(api.dashboard.archive, { today });
  if (items === undefined) return <Loading />;

  const months = [...new Set(items.map((c) => c.date.slice(0, 7)))];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="titulo text-6xl md:text-7xl">Arquivo</h1>
        <p className="max-w-xl text-lg leading-relaxed text-texto-3">
          Novo mês, novas coisas. O que ficou em aberto nos meses anteriores sai da entrada do Hub e fica guardado aqui. Nada foi apagado: marque como postado, mude o status ou mande para a lixeira.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="flex items-center gap-3 rounded-peca bg-white px-5 py-6 text-base text-texto-2">
          <Asterisk size={22} color="var(--color-rosa)" /> Nada pendente de meses anteriores.
        </p>
      ) : (
        months.map((m) => {
          const list = items.filter((c) => c.date.startsWith(m));
          return (
            <section key={m} aria-labelledby={`arq-${m}`} className="flex flex-col gap-3">
              <h2 id={`arq-${m}`} className="flex items-baseline gap-3 text-2xl font-extrabold tracking-tight">
                {monthName(m)} {m.slice(0, 4)}
                <span className="text-sm font-semibold text-texto-2">{list.length === 1 ? "1 peça" : `${list.length} peças`}</span>
              </h2>
              <ul className="flex flex-col gap-2.5">
                {list.map((c, i) => (
                  <li key={c._id} className="flex items-center gap-3.5 rounded-peca bg-white p-3">
                    <Link href={`/w/${c.client.slug}/c/${c._id}`} className="shrink-0" aria-label={`Abrir ${c.title}`}>
                      <Thumb url={c.coverUrl} tone={i} label={c.coverUrl ? undefined : FORMAT[c.format]} className="h-[70px] w-14 rounded-lg" />
                    </Link>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-texto-3">
                        <span aria-hidden="true" className="size-2 rounded-full" style={{ background: c.client.accentColor }} />
                        {c.client.name}
                      </span>
                      <Link href={`/w/${c.client.slug}/c/${c._id}`} className="truncate text-[15px] font-bold hover:underline">
                        {c.title}
                      </Link>
                      <span className="text-xs text-texto-2">Era para {shortDate(c.date)}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1.5">
                      <StatusMenu contentId={c._id} status={c.status} editable short className="text-[11px]" />
                      <TrashButton contentId={c._id} title={c.title} editable className="size-7 border border-linha" />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </main>
  );
}
