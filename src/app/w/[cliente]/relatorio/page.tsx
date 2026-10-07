"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { Asterisk, Loading } from "@/components/brand";
import { Body, monday, lastDay, type FullReport } from "@/components/report/ReportBody";
import { useWorkspace } from "@/components/WorkspaceShell";
import { addDays, monthName, shiftMonth, shortDate, todayISO } from "@/lib/dates";


export default function RelatorioPage() {
  const ws = useWorkspace();
  const today = todayISO();
  const [mode, setMode] = useState<"semana" | "mes">("semana");
  const [anchor, setAnchor] = useState(today);

  const from = mode === "semana" ? monday(anchor) : `${anchor.slice(0, 7)}-01`;
  const to = mode === "semana" ? addDays(from, 6) : lastDay(anchor.slice(0, 7));
  const r = useQuery(api.instagram.report, ws.viewerRole === "admin" ? { slug: ws.slug, from, to } : "skip");

  if (ws.viewerRole !== "admin") return <p className="px-6 py-16 text-lg">O relatório fica com o estúdio.</p>;

  const go = (delta: number) => setAnchor(mode === "semana" ? addDays(from, delta * 7) : `${shiftMonth(anchor.slice(0, 7), delta)}-01`);
  const label = mode === "semana" ? `de ${shortDate(from)} a ${shortDate(to)}` : `em ${monthName(from.slice(0, 7)).toLowerCase()}`;
  const isCurrent = today >= from && today <= to;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 pb-14 pt-4 md:px-6">
      <header className="flex flex-col gap-4">
        <h1 className="titulo flex items-center gap-3 text-5xl md:text-7xl">
          Relatório <Asterisk size={40} color="var(--color-rosa)" />
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Período" className="grid grid-cols-2 rounded-full bg-white p-1">
            {(["semana", "mes"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setAnchor(today);
                }}
                className={`min-h-10 rounded-full px-5 text-sm font-semibold ${mode === m ? "bg-vinho text-white" : "text-texto-3"}`}
              >
                {m === "semana" ? "Semanal" : "Mensal"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Período anterior" onClick={() => go(-1)} className="flex size-10 items-center justify-center rounded-full hover:bg-white">‹</button>
            <span className="min-w-40 text-center text-[15px] font-bold">
              {mode === "semana" ? `${shortDate(from)} a ${shortDate(to)}` : `${monthName(from.slice(0, 7))} ${from.slice(0, 4)}`}
            </span>
            <button type="button" aria-label="Próximo período" disabled={isCurrent} onClick={() => go(1)} className="flex size-10 items-center justify-center rounded-full hover:bg-white disabled:opacity-30">›</button>
          </div>
        </div>
      </header>

      {r === undefined ? (
        <Loading />
      ) : !r.account ? (
        <div className="flex flex-col gap-3 rounded-peca bg-white p-6">
          <strong className="text-xl">O Instagram de {ws.name} ainda não está conectado.</strong>
          <p className="text-texto-3">Gere o link de conexão em Clientes e acessos e mande para a cliente autorizar. Depois disso, tudo aparece aqui sozinho.</p>
          <Link href="/estudio/clientes" className="min-h-11 content-center self-start text-sm font-semibold text-rosa-forte">Ir para Clientes e acessos</Link>
        </div>
      ) : (
        <Body r={r as FullReport} label={label} />
      )}
    </main>
  );
}

