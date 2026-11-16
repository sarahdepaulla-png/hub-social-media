"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Asterisk, Loading } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { stamp } from "@/lib/dates";

const NAMES: Record<string, string> = {
  contents: "peças",
  briefings: "briefings",
  captions: "legendas",
  monthPlans: "planos",
  comments: "comentários",
  ideas: "ideias",
  pautas: "pautas",
};

/** Histórico e backups: briefings apagados para trazer de volta e a cópia diária de tudo. */
export default function HistoricoPage() {
  const deleted = useQuery(api.revisions.deletedBriefings, {});
  const backups = useQuery(api.revisions.backups);
  const restore = useMutation(api.revisions.restore);
  const backupNow = useMutation(api.revisions.backupNow);
  const [msg, setMsg] = useState<string | null>(null);

  if (deleted === undefined || backups === undefined) return <Loading />;

  const bring = async (id: Id<"revisions">) => {
    setMsg(null);
    try {
      await restore({ revisionId: id });
      setMsg("Briefing de volta na esteira.");
    } catch (e) {
      setMsg(errorText(e));
    }
  };

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="titulo flex items-center gap-3 text-6xl md:text-7xl">
          Histórico <Asterisk size={40} color="var(--color-rosa)" />
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-texto-3">
          O Hub salva sozinho uma versão antes de cada mudança em briefings, peças do calendário, legendas e planos. Para voltar uma versão, abra o item e use &ldquo;Versões&rdquo;. Aqui ficam os briefings apagados e a cópia de segurança diária de tudo.
        </p>
      </header>

      {msg && <p role="status" className="text-sm font-semibold text-rosa-forte">{msg}</p>}

      <section aria-labelledby="apagados" className="flex flex-col gap-3">
        <h2 id="apagados" className="text-2xl font-extrabold tracking-tight">
          Briefings apagados
        </h2>
        {deleted.length === 0 ? (
          <p className="rounded-peca bg-white px-5 py-5 text-base text-texto-2">Nenhum briefing apagado.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {deleted.map((d) => (
              <li key={d._id} className="flex flex-wrap items-center gap-3 rounded-peca bg-white px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="truncate text-[15px]">{d.label}</strong>
                  <span className="text-xs text-texto-2">
                    {d.client} · apagado {stamp(d.at)} por {d.who}
                  </span>
                </span>
                <button type="button" onClick={() => void bring(d._id)} className="min-h-10 rounded-full border-[1.5px] border-vinho px-4 text-sm font-semibold hover:bg-creme">
                  Trazer de volta
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="backups" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="backups" className="text-2xl font-extrabold tracking-tight">
            Cópia de segurança diária
          </h2>
          <button
            type="button"
            onClick={() => void backupNow({}).then(() => setMsg("Backup em andamento. Aparece aqui em alguns segundos."))}
            className="min-h-11 rounded-full bg-vinho px-5 text-sm font-bold text-white hover:bg-vinho-escuro"
          >
            Fazer backup agora
          </button>
        </div>
        <p className="text-sm text-texto-2">Todo dia às 3h o Hub guarda tudo num arquivo: clientes, peças, legendas, briefings, planos, comentários, ideias e pautas. Ficam os últimos 30 dias.</p>
        {backups.length === 0 ? (
          <p className="rounded-peca bg-white px-5 py-5 text-base text-texto-2">O primeiro backup sai hoje de madrugada, ou agora pelo botão.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {backups.map((b) => (
              <li key={b._id} className="flex flex-wrap items-center gap-3 rounded-peca bg-white px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="text-[15px]">{stamp(b.at)}</strong>
                  <span className="text-xs text-texto-2">
                    {Object.entries(NAMES)
                      .filter(([k]) => b.counts?.[k] !== undefined)
                      .map(([k, label]) => `${b.counts[k]} ${label}`)
                      .join(" · ")}
                  </span>
                </span>
                {b.url && (
                  <Link href={b.url} target="_blank" className="min-h-10 content-center rounded-full border-[1.5px] border-vinho px-4 text-sm font-semibold hover:bg-creme">
                    Baixar
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
