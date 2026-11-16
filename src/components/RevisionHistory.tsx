"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { errorText } from "@/components/content/DecisionSheet";
import { stamp } from "@/lib/dates";

const KIND = { briefing: "Briefing", conteudo: "Ficha", legendas: "Legendas", plano: "Plano" } as const;

/** Versões salvas automaticamente antes de cada mudança, com "Restaurar". Só a admin vê. */
export function RevisionHistory({ targetId, empty = "Nenhuma versão anterior ainda. A cada mudança, a versão de antes fica guardada aqui." }: { targetId: string; empty?: string }) {
  const rows = useQuery(api.revisions.list, { targetId });
  const restore = useMutation(api.revisions.restore);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (rows === undefined) return <p className="text-sm text-texto-2">Carregando versões…</p>;
  if (rows.length === 0) return <p className="text-sm text-texto-2">{empty}</p>;

  const run = async (id: Id<"revisions">) => {
    if (!window.confirm("Voltar para esta versão? A versão de agora também fica guardada, dá para desfazer.")) return;
    setBusy(id);
    setMsg(null);
    try {
      await restore({ revisionId: id });
      setMsg("Versão restaurada.");
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {msg && <p role="status" className="text-sm font-semibold text-rosa-forte">{msg}</p>}
      <ol className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r._id} className="flex flex-col gap-1.5 rounded-xl bg-creme px-3 py-2.5">
            <span className="flex flex-wrap items-center gap-2 text-xs text-texto-2">
              <span className="rounded-full bg-white px-2 font-bold leading-5 text-vinho">{KIND[r.kind]}</span>
              {stamp(r.at)} · {r.who} · {r.reason.toLowerCase()}
            </span>
            <span className="line-clamp-2 text-sm text-texto-3">{r.preview}</span>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run(r._id)}
              className="min-h-9 self-start rounded-full border-[1.5px] border-vinho px-3 text-xs font-semibold hover:bg-white disabled:opacity-50"
            >
              {busy === r._id ? "Restaurando…" : "Restaurar esta versão"}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
