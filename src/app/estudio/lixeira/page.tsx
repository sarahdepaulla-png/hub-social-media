"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Asterisk, Loading, StatusTag, Thumb } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { shortDate, stamp } from "@/lib/dates";
import { FORMAT } from "@/lib/labels";

/** Peças apagadas: ficam 15 dias e somem sozinhas. Dá para restaurar ou apagar antes. */
export default function LixeiraPage() {
  const items = useQuery(api.contents.trashList, {});
  const restore = useMutation(api.contents.restore);
  const remove = useMutation(api.contents.remove);
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorText(err));
    }
  };

  if (items === undefined) return <Loading />;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="titulo text-6xl md:text-7xl">Lixeira</h1>
        <p className="max-w-xl text-lg leading-relaxed text-texto-3">
          O que você apaga fica aqui por 15 dias, com mídia, legendas e comentários. Depois disso some de vez.
        </p>
      </header>
      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}

      {items.length === 0 ? (
        <p className="flex items-center gap-3 rounded-peca bg-white px-5 py-6 text-base text-texto-2">
          <Asterisk size={22} color="var(--color-rosa)" /> Lixeira vazia.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((c, i) => (
            <li key={c._id} className="flex flex-wrap items-center gap-4 rounded-peca bg-white p-3 md:flex-nowrap">
              <Thumb url={c.coverUrl} tone={i} label={c.coverUrl ? undefined : FORMAT[c.format]} className="h-[76px] w-[60px] shrink-0 rounded-lg opacity-70" />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-texto-3">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ background: c.client.accentColor }} />
                  {c.client.name}
                </span>
                <Link href={`/w/${c.client.slug}/c/${c._id}`} className="truncate text-[15px] font-bold hover:underline">
                  {c.title}
                </Link>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-2">
                  <span>Era para {shortDate(c.date)}</span>
                  <StatusTag status={c.status} short className="text-xs" />
                  <span>Apagada {stamp(c.deletedAt)}</span>
                </span>
              </span>
              <span className="flex w-full items-center justify-between gap-3 md:w-auto md:justify-end">
                <span className={`text-xs font-semibold ${c.daysLeft <= 3 ? "text-st-ajuste-texto" : "text-texto-2"}`}>
                  {c.daysLeft <= 0 ? "Some hoje" : c.daysLeft === 1 ? "Some amanhã" : `Some em ${c.daysLeft} dias`}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => act(() => restore({ contentId: c._id as Id<"contents"> }))}
                    className="min-h-10 rounded-full bg-vinho px-4 text-sm font-semibold text-white"
                  >
                    Restaurar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Apagar "${c.title}" de vez? Não dá para desfazer.`)) act(() => remove({ contentId: c._id as Id<"contents"> }));
                    }}
                    className="min-h-10 rounded-full border-[1.5px] border-st-ajuste px-4 text-sm font-semibold text-st-ajuste-texto"
                  >
                    Apagar agora
                  </button>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
