"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Loading } from "@/components/brand";
import { useWorkspace } from "@/components/WorkspaceShell";
import { errorText } from "@/components/content/DecisionSheet";
import { longDate, stamp, todayISO } from "@/lib/dates";

type Data = NonNullable<ReturnType<typeof useQuery<typeof api.revisions.forClient>>>;

const AREAS = {
  tudo: { label: "Tudo", kinds: null },
  pecas: { label: "Calendário e peças", kinds: ["status", "decisao", "versao", "edicao", "midia", "criacao"] },
  legendas: { label: "Legendas", kinds: ["legenda"] },
  briefings: { label: "Briefings e ideias", kinds: ["briefing", "ideia"] },
  comentarios: { label: "Comentários", kinds: ["comentario"] },
  plano: { label: "Plano do mês", kinds: ["plano"] },
  entradas: { label: "Entradas no Hub", kinds: ["entrada"] },
} as const;
type Area = keyof typeof AREAS;

const VERSION_KIND = { briefing: "Briefing", conteudo: "Ficha da peça", legendas: "Legendas", plano: "Plano do mês" } as const;

const chip = (on: boolean) =>
  `min-h-10 rounded-full px-4 text-sm font-semibold ${on ? "bg-vinho text-white" : "bg-white text-vinho hover:bg-[#FFF6FA]"}`;

/** Agrupa por dia: "hoje", "ontem" ou a data por extenso. */
function byDay<T extends { at: number }>(rows: T[]) {
  const today = todayISO();
  const yesterday = todayISO(new Date(Date.now() - 86_400_000));
  const groups: { day: string; label: string; rows: T[] }[] = [];
  for (const r of rows) {
    const day = todayISO(new Date(r.at));
    let g = groups.at(-1);
    if (!g || g.day !== day) {
      g = { day, label: day === today ? "Hoje" : day === yesterday ? "Ontem" : longDate(day), rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }
  return groups;
}

function Changes({ data, base, admin }: { data: Data; base: string; admin: boolean }) {
  const [area, setArea] = useState<Area>("tudo");
  const [limit, setLimit] = useState(60);
  const areas = (Object.keys(AREAS) as Area[]).filter((a) => admin || (a !== "entradas" && a !== "plano") || (a === "plano" && data.changes.some((c) => c.kind === "plano")));
  const kinds = AREAS[area].kinds as readonly string[] | null;
  const rows = data.changes.filter((c) => !kinds || kinds.includes(c.kind));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por área">
        {areas.map((a) => (
          <button key={a} type="button" aria-pressed={area === a} onClick={() => setArea(a)} className={chip(area === a)}>
            {AREAS[a].label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-[22px] bg-white p-5 text-base text-texto-3">Nada por aqui ainda.</p>
      ) : (
        byDay(rows.slice(0, limit)).map((g) => (
          <section key={g.day} className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-texto-2 first-letter:uppercase">{g.label}</h2>
            <ol className="flex flex-col divide-y divide-linha rounded-[22px] bg-white">
              {g.rows.map((c) => (
                <li key={c._id} className="flex flex-col gap-0.5 px-5 py-3.5">
                  <span className="text-[15px] leading-snug">
                    <strong>{c.who}</strong> · {c.summary}
                  </span>
                  <span className="text-[13px] text-texto-2">
                    {stamp(c.at).split(", ")[1]}
                    {c.contentId && (
                      <>
                        {" · "}
                        <Link href={`${base}/c/${c.contentId}`} className="font-semibold text-rosa-forte hover:underline">
                          {c.contentTitle}
                        </Link>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
      {rows.length > limit && (
        <button type="button" onClick={() => setLimit((n) => n + 60)} className="min-h-11 self-start rounded-full border-[1.5px] border-vinho px-5 text-sm font-semibold hover:bg-white">
          Ver mais antigos
        </button>
      )}
    </div>
  );
}

function Versions({ data, base }: { data: Data; base: string }) {
  const restore = useMutation(api.revisions.restore);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [limit, setLimit] = useState(40);

  const run = async (id: Id<"revisions">) => {
    if (!window.confirm("Voltar para esta versão? A versão de agora também fica guardada, dá para desfazer.")) return;
    setBusy(id);
    setMsg(null);
    try {
      await restore({ revisionId: id });
      setMsg("Pronto, a versão voltou. A de antes ficou guardada aqui também.");
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const href = (v: Data["versions"][number]) =>
    v.kind === "briefing" ? `${base}/briefing/${v.targetId}` : v.kind === "plano" ? `${base}/plano${v.month ? `?mes=${v.month}` : ""}` : `${base}/c/${v.targetId}`;

  if (data.versions.length === 0) {
    return <p className="rounded-[22px] bg-white p-5 text-base text-texto-3">Nenhuma versão guardada ainda. A cada alteração, a versão de antes fica aqui.</p>;
  }
  return (
    <div className="flex flex-col gap-5">
      {msg && (
        <p role="status" className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-rosa-forte">
          {msg}
        </p>
      )}
      {byDay(data.versions.slice(0, limit)).map((g) => (
        <section key={g.day} className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-texto-2">{g.label}</h2>
          <ol className="flex flex-col gap-2">
            {g.rows.map((v) => (
              <li key={v._id} className="flex flex-col gap-2 rounded-[22px] bg-white px-5 py-4">
                <span className="flex flex-wrap items-center gap-2 text-[13px] text-texto-2">
                  <span className="rounded-full bg-creme px-2.5 font-bold leading-6 text-vinho">{VERSION_KIND[v.kind]}</span>
                  {stamp(v.at).split(", ")[1]} · {v.who} · {v.reason.toLowerCase()}
                </span>
                <Link href={href(v)} className="text-base font-bold hover:underline">
                  {v.label || "Sem título"}
                </Link>
                <span className="line-clamp-2 text-sm text-texto-3">{v.preview}</span>
                {v.canRestore && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void run(v._id)}
                    className="min-h-10 self-start rounded-full border-[1.5px] border-vinho px-4 text-sm font-semibold hover:bg-creme disabled:opacity-50"
                  >
                    {busy === v._id ? "Restaurando…" : "Voltar para esta versão"}
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
      {data.versions.length > limit && (
        <button type="button" onClick={() => setLimit((n) => n + 40)} className="min-h-11 self-start rounded-full border-[1.5px] border-vinho px-5 text-sm font-semibold hover:bg-white">
          Ver mais antigas
        </button>
      )}
    </div>
  );
}

export default function HistoricoPage() {
  const ws = useWorkspace();
  const data = useQuery(api.revisions.forClient, { slug: ws.slug });
  const [tab, setTab] = useState<"mudou" | "versoes">("mudou");
  const base = `/w/${ws.slug}`;
  if (data === undefined) return <Loading />;
  const admin = ws.viewerRole === "admin";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-28 pt-4 md:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="titulo text-5xl md:text-6xl">Histórico</h1>
        <p className="max-w-[560px] text-base leading-relaxed text-texto-3">
          Tudo o que mudou na conta{admin ? ` de ${ws.name}` : ""}, de quem e quando. O Hub salva sozinho enquanto vocês escrevem e guarda a versão de antes de cada alteração.
        </p>
      </header>
      <div className="flex gap-1 self-start rounded-full bg-white p-1" role="tablist" aria-label="Histórico">
        <button type="button" role="tab" aria-selected={tab === "mudou"} onClick={() => setTab("mudou")} className={`min-h-10 rounded-full px-4 text-sm font-semibold ${tab === "mudou" ? "bg-vinho text-white" : "text-vinho"}`}>
          O que mudou
        </button>
        <button type="button" role="tab" aria-selected={tab === "versoes"} onClick={() => setTab("versoes")} className={`min-h-10 rounded-full px-4 text-sm font-semibold ${tab === "versoes" ? "bg-vinho text-white" : "text-vinho"}`}>
          Versões guardadas ({data.versions.length})
        </button>
      </div>
      {tab === "mudou" ? <Changes data={data} base={base} admin={admin} /> : <Versions data={data} base={base} />}
    </main>
  );
}
