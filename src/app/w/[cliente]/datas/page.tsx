"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Loading, SelectionBox } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { useWorkspace } from "@/components/WorkspaceShell";
import { addDays, todayISO } from "@/lib/dates";

function dayParts(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(d).replace(".", "");
  const mo = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(d).replace(".", "");
  return { day: iso.slice(8), sub: `${mo}, ${wd}` };
}

export default function DatasPage() {
  const ws = useWorkspace();
  const today = todayISO();
  const list = useQuery(api.opportunities.forClient, { slug: ws.slug, from: today, to: addDays(today, 90) });
  const request = useMutation(api.opportunities.request);
  const [error, setError] = useState<string | null>(null);
  const admin = ws.viewerRole === "admin";
  const base = `/w/${ws.slug}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 pb-12 pt-4">
      <header className="flex flex-col gap-4">
        <h1 className="titulo text-5xl md:text-7xl">Datas que rendem conteúdo</h1>
        <SelectionBox tone="rosa" className="self-start px-3.5 py-2 text-[15px] leading-snug">
          Os próximos 90 dias para <strong>{ws.niches.join(", ") || "o seu nicho"}</strong>.
        </SelectionBox>
      </header>
      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}

      {list === undefined ? (
        <Loading />
      ) : list.length === 0 ? (
        <p className="text-base text-texto-2">Nenhuma data cadastrada para os próximos meses. O estúdio vai completar a biblioteca.</p>
      ) : (
        <ul className="flex flex-col">
          {list.map((o) => {
            const p = dayParts(o.date);
            return (
              <li key={o._id} className="grid grid-cols-[68px_minmax(0,1fr)] gap-4 border-t border-linha py-4 last:border-b">
                <span className="flex flex-col leading-[0.9]">
                  <span className="text-[40px] font-extrabold tracking-[-0.05em]">{o.allMonth ? "Mês" : p.day}</span>
                  <span className="text-[13px] text-texto-2">{o.allMonth ? "inteiro" : p.sub}</span>
                </span>
                <span className="flex flex-col items-start gap-2">
                  <strong className="text-[17px] leading-snug">{o.title}</strong>
                  {o.hint && <span className="text-sm leading-relaxed text-texto-2">{o.hint}</span>}
                  {o.contentId ? (
                    <Link href={`${base}/c/${o.contentId}`} className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-semibold text-st-agendado">
                      <span className="size-2 rounded-full bg-st-agendado" /> Já está no calendário
                    </Link>
                  ) : admin ? (
                    <Link
                      href={`${base}/novo?data=${o.allMonth ? today : o.date}&tema=${encodeURIComponent(o.title)}&oportunidade=${o._id}`}
                      className="inline-flex min-h-10 items-center rounded-full bg-vinho px-4 text-sm font-semibold text-white"
                    >
                      Criar conteúdo{o.requested ? " (cliente pediu)" : ""}
                    </Link>
                  ) : o.requested ? (
                    <span className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-semibold text-rosa-forte">
                      <span className="size-2 rounded-full bg-rosa-forte" /> Pedido enviado ao estúdio
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => request({ slug: ws.slug, opportunityId: o._id as Id<"opportunities"> }).catch((e) => setError(errorText(e)))}
                      className="inline-flex min-h-10 items-center rounded-full border-[1.5px] border-vinho px-4 text-sm font-semibold"
                    >
                      Quero conteúdo sobre isso
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
