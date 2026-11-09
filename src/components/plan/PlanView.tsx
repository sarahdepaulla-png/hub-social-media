"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { Asterisk, buttonClass } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { Linkify } from "@/components/Linkify";
import { monthName, stamp } from "@/lib/dates";
import { FORMAT } from "@/lib/labels";
import { PHASE_COLORS, dayLabel, rangeLabel } from "./planLook";

type Data = FunctionReturnType<typeof api.plans.get>;
type Plan = NonNullable<Data["plan"]>;
type Piece = Data["pieces"][number] & { phase: number | null };

const eyebrow = "text-[13px] font-bold uppercase tracking-[0.08em] text-rosa-forte";
const h2 = "titulo text-[36px] md:text-[44px]";

/** Capa: a arte, se já existe; senão um rascunho limpo com a frase da capa. */
function Cover({ p }: { p: Piece }) {
  if (p.coverUrl) return <img src={p.coverUrl} alt="" className="aspect-[4/5] w-full rounded-2xl object-cover" />;
  return (
    <span className="flex aspect-[4/5] w-full items-center justify-center rounded-2xl bg-[#FBF6F3] p-5 text-center ring-1 ring-linha">
      <span className="font-[Georgia,serif] text-[17px] italic leading-snug text-vinho">{p.hook ?? p.title}</span>
    </span>
  );
}

function PostCard({ p, n, base }: { p: Piece; n: number; base: string }) {
  return (
    <li className="flex flex-col gap-3">
      <Link href={`${base}/c/${p._id}`} aria-label={`Abrir ${p.title}`} className="relative block transition-transform hover:-translate-y-0.5">
        <Cover p={p} />
        <span className="absolute left-2.5 top-2.5 flex size-7 items-center justify-center rounded-full bg-white text-xs font-bold text-vinho shadow-sm">{n}</span>
      </Link>
      <div className="flex flex-col gap-1 px-0.5">
        <span className="text-[13px] font-semibold text-texto-2">
          {dayLabel(p.date)} · {FORMAT[p.format]}
        </span>
        <Link href={`${base}/c/${p._id}`} className="text-base font-bold leading-snug hover:underline">
          {p.title}
        </Link>
        {p.note && (
          <details className="group mt-1 text-sm">
            <summary className="cursor-pointer list-none font-semibold text-rosa-forte">
              <span className="group-open:hidden">Ver a ideia</span>
              <span className="hidden group-open:inline">Fechar</span>
            </summary>
            <p className="mt-2 whitespace-pre-line rounded-xl bg-creme p-3 leading-relaxed text-texto-3">
              <Linkify text={p.note} />
            </p>
          </details>
        )}
      </div>
    </li>
  );
}

export function PlanView({ data, plan, slug, month }: { data: Data; plan: Plan; slug: string; month: string }) {
  const base = `/w/${slug}`;
  const toggleNeed = useMutation(api.plans.toggleNeed);
  const decide = useMutation(api.plans.decide);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phaseOf = (date: string) => {
    const i = plan.phases.findIndex((ph) => date >= ph.start && date <= ph.end);
    return i < 0 ? null : i;
  };
  const pieces: Piece[] = data.pieces.filter((p) => p.inPlan).map((p) => ({ ...p, phase: phaseOf(p.date) }));
  const number = new Map(pieces.map((p, i) => [p._id, i + 1]));
  const groups = [
    ...plan.phases.map((ph, i) => ({ key: `f${i}`, title: ph.name, range: rangeLabel(ph.start, ph.end), color: PHASE_COLORS[i % PHASE_COLORS.length], list: pieces.filter((p) => p.phase === i) })),
    { key: "outros", title: plan.phases.length ? "Outros posts" : "Os posts", range: "", color: "#B88AA0", list: pieces.filter((p) => p.phase === null) },
  ].filter((g) => g.list.length > 0);

  const first = pieces[0]?.date;
  const last = pieces.at(-1)?.date;
  const waiting = plan.status === "aguardando";
  const live = data.canDecide && waiting;
  const mes = monthName(month).toLowerCase();

  const send = async (type: "aprovado" | "ajuste") => {
    setBusy(true);
    setError(null);
    try {
      await decide({ slug, month, type, comment: comment.trim() || undefined });
      setComment("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-16 md:gap-20">
      {/* Capa */}
      <section aria-labelledby="plano-tema" className="flex flex-col gap-5">
        <span className={eyebrow}>
          Plano de {mes} · {waiting ? "para sua aprovação" : plan.status === "aprovado" ? "aprovado" : plan.status === "ajuste" ? "ajuste pedido" : "rascunho"}
        </span>
        <h1 id="plano-tema" className="titulo max-w-[900px] text-[48px] md:text-[80px]">
          {plan.theme}
        </h1>
        {plan.concept && <p className="max-w-[640px] whitespace-pre-line text-lg leading-relaxed text-texto-3">{plan.concept}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-texto-3">
            {pieces.length} {pieces.length === 1 ? "post" : "posts"}
            {first && last ? ` · ${rangeLabel(first, last)}` : ""}
          </span>
          {live && (
            <a href="#aprovar" className="inline-flex min-h-11 items-center rounded-full bg-vinho px-5 text-sm font-bold text-white hover:bg-vinho-escuro">
              Ver e aprovar
            </a>
          )}
        </div>
      </section>

      {/* O caminho */}
      {plan.phases.length > 0 && (
        <section aria-labelledby="plano-caminho" className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <span className={eyebrow}>O caminho do mês</span>
            <h2 id="plano-caminho" className={h2}>
              Como o mês vai andar
            </h2>
          </div>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-3" style={plan.phases.length !== 3 ? { gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))` } : undefined}>
            {plan.phases.map((ph, i) => (
              <li key={ph.name + i} className="flex gap-4 rounded-[22px] bg-white p-5">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full text-base font-extrabold text-white" style={{ background: PHASE_COLORS[i % PHASE_COLORS.length] }}>
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <strong className="text-xl leading-tight">{ph.name}</strong>
                  <span className="text-[13px] font-semibold text-texto-2">{rangeLabel(ph.start, ph.end)}</span>
                  {ph.intent && <span className="mt-1 text-[15px] leading-relaxed text-texto-3">{ph.intent}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Os posts */}
      {pieces.length > 0 && (
        <section aria-labelledby="plano-posts" className="flex flex-col gap-8">
          <div className="flex flex-col gap-1.5">
            <span className={eyebrow}>O que vai ao ar</span>
            <h2 id="plano-posts" className={h2}>
              Os posts de {mes}
            </h2>
          </div>
          {groups.map((g) => (
            <div key={g.key} className="flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="h-[3px] w-6 rounded-full" style={{ background: g.color }} />
                <h3 className="text-lg font-extrabold">{g.title}</h3>
                {g.range && <span className="text-sm text-texto-2">{g.range}</span>}
              </div>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-7 md:grid-cols-4">
                {g.list.map((p) => (
                  <PostCard key={p._id} p={p} n={number.get(p._id) ?? 0} base={base} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Pendências */}
      {plan.needs.length > 0 && (
        <section aria-labelledby="plano-preciso" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className={eyebrow}>Para sair do papel</span>
            <h2 id="plano-preciso" className={h2}>
              O que preciso de você
            </h2>
          </div>
          <ul className="flex flex-col gap-2">
            {plan.needs.map((n, i) => (
              <li key={n.text + i}>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={n.done}
                    onChange={() => void toggleNeed({ slug, month, index: i }).catch((e) => setError(errorText(e)))}
                    className="mt-0.5 size-[18px] shrink-0 accent-rosa-forte"
                  />
                  <span className="flex flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <span className={`text-[15px] leading-snug ${n.done ? "text-texto-2 line-through" : ""}`}>{n.text}</span>
                    {n.due && <span className="text-xs font-bold text-rosa-forte">{n.due}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Aprovação */}
      <section id="aprovar" aria-labelledby="plano-aprovar" className="flex scroll-mt-6 flex-col gap-4 rounded-[28px] bg-vinho p-6 text-white md:p-9">
        {plan.status === "aprovado" ? (
          <>
            <h2 id="plano-aprovar" className={`${h2} flex items-center gap-3`}>
              Plano aprovado <Asterisk size={30} color="var(--color-rosa)" />
            </h2>
            {plan.decision && (
              <p className="text-[17px] text-creme">
                Por {plan.decision.name}, {stamp(plan.decision.at)}.{plan.decision.comment ? ` "${plan.decision.comment}"` : ""}
              </p>
            )}
            <p className="max-w-[640px] text-[15px] leading-relaxed text-creme">Os posts já estão no calendário. Cada um ainda chega para aprovação quando a arte ficar pronta.</p>
          </>
        ) : plan.status === "ajuste" ? (
          <>
            <h2 id="plano-aprovar" className={h2}>
              Ajuste pedido
            </h2>
            {plan.decision && (
              <p className="max-w-[640px] whitespace-pre-line text-[17px] leading-relaxed text-creme">
                {plan.decision.name}, {stamp(plan.decision.at)}: &ldquo;{plan.decision.comment}&rdquo;
              </p>
            )}
            <p className="text-[15px] text-creme">O estúdio vai ajustar e mandar de novo.</p>
          </>
        ) : (
          <>
            <h2 id="plano-aprovar" className={h2}>
              Gostou do caminho?
            </h2>
            <p className="max-w-[640px] text-[17px] leading-relaxed text-creme">
              Aprovando, os {pieces.length === 1 ? "post entra" : `${pieces.length} posts entram`} no calendário de {mes}. Cada post ainda chega para você aprovar quando a arte ficar pronta.
            </p>
            <label className="flex max-w-[640px] flex-col gap-2 text-sm font-semibold">
              Quer mudar algo? Escreva aqui
              <textarea
                rows={3}
                value={comment}
                disabled={!live}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ex.: prefiro trocar o post do dia 18 por outro tema"
                className="resize-y rounded-2xl bg-white px-3.5 py-3 text-base font-normal text-vinho disabled:opacity-70"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm font-semibold text-rosa">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={busy || !live} onClick={() => void send("aprovado")} className={`${buttonClass.secondary} disabled:cursor-not-allowed`}>
                Aprovar e mandar pro calendário
              </button>
              <button
                type="button"
                disabled={busy || !live}
                onClick={() => (comment.trim() ? void send("ajuste") : setError("Escreva o que você quer mudar e toque de novo."))}
                className="inline-flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-rosa px-6 text-base font-semibold text-white hover:bg-vinho-escuro disabled:cursor-not-allowed disabled:opacity-50"
              >
                Pedir ajuste no plano
              </button>
            </div>
            {!live && (
              <p className="text-sm font-semibold text-rosa">
                {data.isAdmin
                  ? plan.status === "rascunho"
                    ? "Prévia: é assim que a cliente vê. Os botões funcionam para ela depois que você tocar em Enviar para a cliente."
                    : "Prévia: os botões funcionam só para a cliente."
                  : "Você está vendo como a cliente: os botões funcionam só para ela."}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
