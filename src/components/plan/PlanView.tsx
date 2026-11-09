"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { Asterisk, buttonClass } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { Linkify } from "@/components/Linkify";
import { monthGrid, monthName, stamp } from "@/lib/dates";
import { FORMAT } from "@/lib/labels";
import { HIGHLIGHT_COLOR, PHASE_COLORS, dayLabel, dayNum, inkOn, rangeLabel, sketchTone } from "./planLook";

type Data = FunctionReturnType<typeof api.plans.get>;
type Plan = NonNullable<Data["plan"]>;
type Piece = Data["pieces"][number] & { color: string; tone: { bg: string; fg: string }; phase: number | null; isHighlight: boolean };

const eyebrow = "text-[13px] font-bold uppercase tracking-[0.08em] text-rosa-forte";
const h2 = "titulo text-[40px] md:text-[46px]";
const card = "rounded-[22px] bg-white";
const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Capa da peça: a arte, se já existe; senão o rascunho com a frase da capa. */
function Cover({ p, className = "", text = "text-[11px]" }: { p: Piece; className?: string; text?: string }) {
  if (p.coverUrl) return <img src={p.coverUrl} alt="" className={`object-cover ${className}`} />;
  return (
    <span
      className={`flex items-center justify-center overflow-hidden p-1.5 text-center ${className}`}
      style={{ background: p.tone.bg, color: p.tone.fg, boxShadow: "inset 0 0 0 1px rgba(59,42,38,0.12)" }}
    >
      <span className={`font-[Georgia,serif] italic leading-[1.1] ${text}`}>{p.hook ?? p.title}</span>
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-[4px]" style={{ background: color }} />;
}

function PieceRow({ p, base, highlightName }: { p: Piece; base: string; highlightName: string | null }) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl p-2" style={{ background: p.isHighlight ? "#E6F4F1" : "transparent" }}>
      <div className="flex gap-3">
        <Link href={`${base}/c/${p._id}`} className="shrink-0" aria-label={`Abrir ${p.title}`}>
          <Cover p={p} className="h-[90px] w-[72px] rounded-lg" />
        </Link>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold text-texto-2">
            {dayLabel(p.date)} · {FORMAT[p.format]}
          </span>
          <Link href={`${base}/c/${p._id}`} className="text-[15px] font-bold leading-tight hover:underline">
            {p.title}
          </Link>
          <span className="flex flex-wrap items-center gap-1.5">
            {p.pillar && <span className="text-xs text-texto-3">{p.pillar}</span>}
            {p.essential && <span className="rounded-full bg-vinho px-2 text-[11px] font-bold leading-5 text-white">Essencial</span>}
            {p.isHighlight && highlightName && (
              <span className="rounded-full px-2 text-[11px] font-bold leading-5 text-white" style={{ background: HIGHLIGHT_COLOR }}>
                {highlightName}
              </span>
            )}
          </span>
        </span>
      </div>
      {p.note && (
        <details className="group rounded-xl bg-creme px-3 py-2 text-sm">
          <summary className="cursor-pointer list-none font-semibold text-rosa-forte group-open:mb-1.5">
            <span className="group-open:hidden">Ver a ideia</span>
            <span className="hidden group-open:inline">Esconder a ideia</span>
          </summary>
          <p className="whitespace-pre-line leading-relaxed text-texto-3">
            <Linkify text={p.note} />
          </p>
        </details>
      )}
    </li>
  );
}

function MixBar({ title, rows }: { title: string; rows: { label: string; count: number; color: string }[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (!total) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <strong className="text-[15px]">{title}</strong>
      <div role="img" aria-label={`${title}: ${rows.map((r) => `${r.label} ${r.count}`).join(", ")}`} className="flex h-10 gap-[3px] overflow-hidden rounded-xl">
        {rows.map((r) => (
          <span key={r.label} style={{ flex: `${r.count} 1 0`, background: r.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {rows.map((r) => (
          <span key={r.label} className="inline-flex items-center gap-2">
            <Dot color={r.color} />
            {r.label} <strong>{r.count}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export function PlanView({ data, plan, slug, month }: { data: Data; plan: Plan; slug: string; month: string }) {
  const base = `/w/${slug}`;
  const toggleNeed = useMutation(api.plans.toggleNeed);
  const decide = useMutation(api.plans.decide);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hl = plan.highlight;
  const phaseOf = (date: string) => {
    const i = plan.phases.findIndex((ph) => date >= ph.start && date <= ph.end);
    return i < 0 ? null : i;
  };
  const pieces: Piece[] = data.pieces.map((p, i) => {
    const phase = phaseOf(p.date);
    const isHighlight = !!hl && p.pillar === hl.pillar;
    return {
      ...p,
      phase,
      isHighlight,
      tone: sketchTone(plan.palette, i),
      color: isHighlight ? HIGHLIGHT_COLOR : phase === null ? "#B88AA0" : PHASE_COLORS[phase % PHASE_COLORS.length],
    };
  });
  const loose = pieces.filter((p) => p.phase === null);
  const hlPieces = pieces.filter((p) => p.isHighlight);
  const essentials = pieces.filter((p) => p.essential).length;
  const byDay = new Map<string, Piece[]>();
  for (const p of pieces) byDay.set(p.date, [...(byDay.get(p.date) ?? []), p]);

  const formatRows = Object.entries(
    pieces.reduce<Record<string, number>>((acc, p) => ({ ...acc, [FORMAT[p.format]]: (acc[FORMAT[p.format]] ?? 0) + 1 }), {}),
  )
    .sort((a, b) => b[1] - a[1])
    .map(([label, count], i) => ({ label, count, color: ["#5C0F31", "#FF8DC7", "#D9A9BD", "#8A63D2", "#F0A030", "#0F7A6E"][i % 6] }));
  const phaseRows = [
    ...plan.phases.map((ph, i) => ({ label: ph.name, count: pieces.filter((p) => p.phase === i).length, color: PHASE_COLORS[i % PHASE_COLORS.length] })),
    ...(loose.length ? [{ label: "Fora das fases", count: loose.length, color: "#B88AA0" }] : []),
  ].filter((r) => r.count > 0);

  const feed = [...pieces.filter((p) => p.platform === "instagram" && p.format !== "stories")].reverse();
  const first = pieces[0]?.date;
  const last = pieces.at(-1)?.date;
  const waiting = plan.status === "aguardando";

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
      {/* Capa do mês */}
      <section aria-labelledby="plano-tema" className="grid grid-cols-1 items-center gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <span className="self-start rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-texto-2">
            Plano de {monthName(month).toLowerCase()} · {waiting ? "para sua aprovação" : plan.status === "aprovado" ? "aprovado" : plan.status === "ajuste" ? "ajuste pedido" : "rascunho"}
          </span>
          <h1 id="plano-tema" className="titulo text-[52px] md:text-[76px]">
            {plan.theme}
          </h1>
          {plan.concept && <p className="max-w-[520px] whitespace-pre-line text-lg leading-relaxed text-texto-3">{plan.concept}</p>}
          {data.canDecide && waiting && (
            <a href="#aprovar" className="inline-flex min-h-12 items-center self-start rounded-full bg-vinho px-6 text-base font-bold text-white hover:bg-vinho-escuro">
              Ver e aprovar o plano
            </a>
          )}
          <div className="flex flex-wrap gap-2.5 text-sm text-texto-3">
            <span className="rounded-full border-[1.5px] border-campo px-3 py-1.5">{pieces.length} {pieces.length === 1 ? "post" : "posts"}</span>
            {first && last && <span className="rounded-full border-[1.5px] border-campo px-3 py-1.5">{rangeLabel(first, last)}</span>}
            {plan.phases.length > 0 && <span className="rounded-full border-[1.5px] border-campo px-3 py-1.5">{plan.phases.length} fases</span>}
            {hl && hlPieces.length > 0 && (
              <span className="rounded-full px-3 py-1.5 font-semibold text-white" style={{ background: HIGHLIGHT_COLOR }}>
                + {hlPieces.length} de {hl.pillar.toLowerCase()}
              </span>
            )}
          </div>
        </div>

        {(plan.moodImages.length > 0 || plan.moodPhrases.length > 0 || plan.palette.length > 0) && (
          <figure aria-label="Moodboard do mês" className="m-0 flex flex-col gap-3 rounded-[22px] bg-white p-3.5 md:rotate-1">
            <div className="grid grid-cols-3 gap-2.5">
              {plan.moodImages.map((m) =>
                m.url ? <img key={m.id} src={m.url} alt="" className="aspect-[4/5] w-full rounded-[10px] object-cover" /> : null,
              )}
              {plan.moodPhrases.map((t, i) => {
                const tone = sketchTone(plan.palette, i + 1);
                return (
                  <span key={t} className="flex aspect-[4/5] items-center justify-center rounded-[10px] p-3 text-center" style={{ background: tone.bg, color: tone.fg }}>
                    <span className="font-[Georgia,serif] text-[17px] italic leading-[1.1]">{t}</span>
                  </span>
                );
              })}
            </div>
            {(plan.mood || plan.palette.length > 0) && (
              <figcaption className="flex flex-wrap items-center justify-between gap-3 px-1">
                {plan.mood && <span className="font-[Georgia,serif] text-xl italic text-texto-3">{plan.mood}</span>}
                {plan.palette.length > 0 && (
                  <span aria-label="Paleta do mês" className="flex gap-1.5">
                    {plan.palette.map((c) => (
                      <span key={c} title={c} className="size-7 rounded-full" style={{ background: c, boxShadow: "inset 0 0 0 1px rgba(59,42,38,0.15)" }} />
                    ))}
                  </span>
                )}
              </figcaption>
            )}
          </figure>
        )}
      </section>

      {/* Objetivos */}
      {plan.goals.length > 0 && (
        <section aria-labelledby="plano-objetivos" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <span className={eyebrow}>O que queremos no mês</span>
            <h2 id="plano-objetivos" className={h2}>
              {plan.goals.length === 1 ? "Um objetivo" : plan.goals.length === 2 ? "Dois objetivos" : plan.goals.length === 3 ? "Três objetivos" : `${plan.goals.length} objetivos`}
            </h2>
          </div>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plan.goals.map((g, i) => (
              <li key={g.title} className={`${card} flex flex-col gap-3.5 p-6`}>
                <span className="titulo text-[60px] text-rosa">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-[21px] font-bold leading-tight">{g.title}</h3>
                {g.how && <p className="text-[15px] leading-relaxed text-texto-3">{g.how}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* O caminho */}
      {plan.phases.length > 0 && (
        <section aria-labelledby="plano-caminho" className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <span className={eyebrow}>O caminho do mês</span>
            <h2 id="plano-caminho" className={h2}>
              {plan.phases.map((p) => p.name).join(", ")}
            </h2>
            <p className="max-w-[680px] text-[17px] leading-relaxed text-texto-3">
              Cada fase prepara a próxima. Toque em &ldquo;Ver a ideia&rdquo; para ler o que vai em cada post.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" style={plan.phases.length === 2 ? { gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" } : undefined}>
            {plan.phases.map((ph, i) => {
              const list = pieces.filter((p) => p.phase === i);
              const color = PHASE_COLORS[i % PHASE_COLORS.length];
              return (
                <article key={ph.name + i} className={`${card} flex flex-col gap-4 border-t-[6px] p-5`} style={{ borderTopColor: color }}>
                  <div className="flex flex-col gap-1">
                    <span className="text-[13px] font-semibold text-texto-2">
                      Fase {i + 1} · {rangeLabel(ph.start, ph.end)}
                    </span>
                    <h3 className="titulo text-[34px]">{ph.name}</h3>
                    {ph.intent && <p className="mt-1 text-[15px] leading-relaxed text-texto-3">{ph.intent}</p>}
                  </div>
                  {list.length > 0 ? (
                    <ul className="flex flex-col gap-1.5">
                      {list.map((p) => (
                        <PieceRow key={p._id} p={p} base={base} highlightName={hl?.pillar ?? null} />
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-texto-2">Nenhum post nesta fase ainda.</p>
                  )}
                  {ph.stories && (
                    <div className="mt-auto flex flex-col gap-1 rounded-2xl bg-creme px-3.5 py-3">
                      <span className="text-xs font-bold uppercase tracking-[0.06em] text-texto-2">Nos stories</span>
                      <span className="whitespace-pre-line text-sm leading-relaxed text-texto-3">{ph.stories}</span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {loose.length > 0 && (
            <div className={`${card} flex flex-col gap-3 p-5`}>
              <h3 className="text-lg font-bold">Fora das fases</h3>
              <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                {loose.map((p) => (
                  <PieceRow key={p._id} p={p} base={base} highlightName={hl?.pillar ?? null} />
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Destaque do mês */}
      {hl && hlPieces.length > 0 && (
        <section aria-labelledby="plano-destaque" className="flex flex-col gap-5 rounded-[28px] p-6 text-white md:p-8" style={{ background: HIGHLIGHT_COLOR }}>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#BDEBE3]">Destaque do mês</span>
            <h2 id="plano-destaque" className={h2}>
              {hl.title}
            </h2>
            {hl.text && <p className="max-w-[680px] text-[17px] leading-relaxed text-[#E6F6F3]">{hl.text}</p>}
          </div>
          <ol className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
            {hlPieces.map((p) => (
              <li key={p._id} className="flex flex-col gap-2.5 rounded-[20px] bg-white p-4 text-vinho">
                <span className="flex items-center justify-between gap-2 text-[13px] font-bold" style={{ color: HIGHLIGHT_COLOR }}>
                  {dayLabel(p.date)} · {FORMAT[p.format]}
                  {p.phase !== null && <span className="font-semibold text-texto-2">{plan.phases[p.phase]?.name}</span>}
                </span>
                <div className="flex gap-3">
                  <Cover p={p} className="h-[90px] w-[72px] shrink-0 rounded-lg" />
                  <h3 className="text-xl font-extrabold leading-tight tracking-tight">{p.title}</h3>
                </div>
                {p.note && <p className="whitespace-pre-line text-sm leading-relaxed text-texto-3">{p.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Mix */}
      {pieces.length > 0 && (
        <section aria-labelledby="plano-mix" className={`${card} grid grid-cols-1 gap-8 p-6 md:grid-cols-2 md:p-8`}>
          <div className="flex flex-col gap-2.5">
            <span className={eyebrow}>Equilíbrio</span>
            <h2 id="plano-mix" className={h2}>
              O mix do mês
            </h2>
            <p className="text-base leading-relaxed text-texto-3">
              {pieces.length} posts no mês
              {essentials > 0 ? `. ${essentials} são essenciais e não caem mesmo se o volume precisar ser cortado.` : "."}
            </p>
          </div>
          <div className="flex flex-col gap-6">
            {phaseRows.length > 0 && <MixBar title="Por fase" rows={phaseRows} />}
            <MixBar title="Por formato" rows={formatRows} />
          </div>
        </section>
      )}

      {/* Calendário */}
      <section aria-labelledby="plano-calendario" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className={eyebrow}>
              {monthName(month)} {month.slice(0, 4)}
            </span>
            <h2 id="plano-calendario" className={h2}>
              O mês no calendário
            </h2>
          </div>
          <span className="flex flex-wrap gap-3.5 text-[13px] text-texto-3">
            {plan.phases.map((ph, i) => (
              <span key={ph.name + i} className="inline-flex items-center gap-1.5">
                <Dot color={PHASE_COLORS[i % PHASE_COLORS.length]} />
                {ph.name}
              </span>
            ))}
            {hl && hlPieces.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Dot color={HIGHLIGHT_COLOR} />
                {hl.pillar}
              </span>
            )}
          </span>
        </div>
        <div className={`${card} overflow-x-auto p-3 md:p-4`}>
          <div className="grid min-w-[720px] grid-cols-7 gap-1.5">
            {WEEK.map((d) => (
              <span key={d} className="px-2 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.06em] text-texto-2">
                {d}
              </span>
            ))}
            {monthGrid(month).map((day, i) => {
              if (!day) return <span key={`x${i}`} />;
              const list = byDay.get(day) ?? [];
              return (
                <div key={day} className="flex min-h-[132px] flex-col gap-1.5 rounded-xl p-2" style={{ background: list.length ? (list[0].isHighlight ? "#E6F4F1" : "#FFF6FA") : "#FBF4F1" }}>
                  <span className={`text-[13px] font-semibold ${list.length ? "text-vinho" : "text-texto-2"}`}>{dayNum(day)}</span>
                  {list.map((p) => (
                    <Link key={p._id} href={`${base}/c/${p._id}`} className="flex flex-col gap-1">
                      <Cover p={p} className="h-[70px] w-full rounded-lg" text="text-[10.5px]" />
                      <span className="text-[11px] font-semibold leading-tight">
                        {FORMAT[p.format]} · {p.title}
                      </span>
                      <span aria-hidden="true" className="h-[3px] w-full rounded-full" style={{ background: p.color }} />
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feed */}
      {feed.length > 0 && (
        <section aria-labelledby="plano-feed" className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
          <div className="flex flex-col gap-2.5">
            <span className={eyebrow}>Visão do perfil</span>
            <h2 id="plano-feed" className={h2}>
              Como o feed fica no fim do mês
            </h2>
            <p className="text-[17px] leading-relaxed text-texto-3">
              {feed.some((p) => !p.coverUrl)
                ? "Onde ainda não tem arte, aparece o rascunho da capa nas cores do mês. A foto real entra no lugar quando for produzida."
                : "As peças do mês no topo, seguidas dos posts que já estão no perfil."}
            </p>
          </div>
          <div className="w-full max-w-[380px] justify-self-center rounded-[28px] bg-white px-2.5 pb-2.5 pt-4 ring-1 ring-linha">
            <div className="flex items-center gap-3 px-2 pb-3.5">
              {data.client.photoUrl ? (
                <img src={data.client.photoUrl} alt="" className="size-[52px] rounded-full object-cover" />
              ) : (
                <span aria-hidden="true" className="flex size-[52px] items-center justify-center rounded-full font-[Georgia,serif] text-2xl" style={{ background: data.client.accentColor, color: inkOn(data.client.accentColor.length === 7 ? data.client.accentColor : "#C2186B") }}>
                  {data.client.name.charAt(0)}
                </span>
              )}
              <span className="flex min-w-0 flex-col">
                <strong className="text-[15px]">{data.client.instagram ? data.client.instagram.replace(/^@?/, "") : data.client.name}</strong>
                {data.client.bio && <span className="line-clamp-1 text-xs text-texto-2">{data.client.bio}</span>}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-0.5">
              {feed.map((p) => (
                <Cover key={p._id} p={p} className="aspect-[4/5] w-full" text="text-[12px]" />
              ))}
              {data.feedTail.map((f) => (f.url ? <img key={f._id} src={f.url} alt="" className="aspect-[4/5] w-full object-cover" /> : null))}
            </div>
          </div>
        </section>
      )}

      {/* Pendências */}
      {plan.needs.length > 0 && (
        <section aria-labelledby="plano-preciso" className={`${card} flex flex-col gap-4 p-6 md:p-8`}>
          <div className="flex flex-col gap-1.5">
            <span className={eyebrow}>Para o plano sair do papel</span>
            <h2 id="plano-preciso" className={h2}>
              O que preciso de você
            </h2>
          </div>
          <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {plan.needs.map((n, i) => (
              <li key={n.text + i}>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl bg-creme px-3.5 py-3">
                  <input
                    type="checkbox"
                    checked={n.done}
                    onChange={() => void toggleNeed({ slug, month, index: i }).catch((e) => setError(errorText(e)))}
                    className="mt-0.5 size-[18px] shrink-0 accent-rosa-forte"
                  />
                  <span className="flex flex-col gap-0.5">
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
      <section id="aprovar" aria-labelledby="plano-aprovar" className="scroll-mt-6 flex flex-col gap-4 rounded-[28px] bg-vinho p-6 text-white md:p-9">
        {plan.status === "aprovado" ? (
          <>
            <h2 id="plano-aprovar" className={`${h2} flex items-center gap-3`}>
              Plano aprovado <Asterisk size={34} color="var(--color-rosa)" />
            </h2>
            {plan.decision && (
              <p className="text-[17px] text-creme">
                Por {plan.decision.name}, {stamp(plan.decision.at)}.{plan.decision.comment ? ` "${plan.decision.comment}"` : ""}
              </p>
            )}
            <p className="max-w-[640px] text-[15px] leading-relaxed text-creme">Cada post continua chegando para aprovação quando a arte ficar pronta.</p>
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
              Aprovando, os {pieces.length === 1 ? "post do plano entra" : `${pieces.length} posts do plano entram`} no calendário de {monthName(month).toLowerCase()}. Cada post ainda chega para você aprovar quando a arte ficar pronta.
            </p>
            <label className="flex max-w-[640px] flex-col gap-2 text-sm font-semibold">
              Quer mudar algo? Escreva aqui
              <textarea
                rows={3}
                value={comment}
                disabled={!(data.canDecide && waiting)}
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
              <button type="button" disabled={busy || !(data.canDecide && waiting)} onClick={() => void send("aprovado")} className={`${buttonClass.secondary} disabled:cursor-not-allowed`}>
                Aprovar e mandar pro calendário
              </button>
              <button
                type="button"
                disabled={busy || !(data.canDecide && waiting)}
                onClick={() => (comment.trim() ? void send("ajuste") : setError("Escreva o que você quer mudar e toque de novo."))}
                className="inline-flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-rosa px-6 text-base font-semibold text-white hover:bg-vinho-escuro disabled:cursor-not-allowed disabled:opacity-50"
              >
                Pedir ajuste no plano
              </button>
            </div>
            {!(data.canDecide && waiting) && (
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
