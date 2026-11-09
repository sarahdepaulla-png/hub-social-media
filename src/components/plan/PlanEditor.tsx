"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";
import { buttonClass } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { monthName } from "@/lib/dates";
import { FORMAT } from "@/lib/labels";
import { dayLabel } from "./planLook";

type Data = FunctionReturnType<typeof api.plans.get>;

const field = "min-h-11 w-full rounded-lg border-[1.5px] border-campo bg-white px-3 text-base font-normal text-vinho";
const area = `${field} resize-y py-2.5 leading-relaxed`;
const label = "flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold";
const box = "flex flex-col gap-4 rounded-[22px] bg-white p-5 md:p-6";
const small = "min-h-9 self-start rounded-full px-3 text-sm font-semibold text-rosa-forte hover:bg-creme";

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(last).padStart(2, "0")}` };
}

/** Formulário da admin: monta e edita o plano do mês. */
export function PlanEditor({ data, slug, month, onDone }: { data: Data; slug: string; month: string; onDone: () => void }) {
  const save = useMutation(api.plans.save);
  const plan = data.plan;
  const { first, last } = monthBounds(month);

  const [theme, setTheme] = useState(plan?.theme ?? "");
  const [concept, setConcept] = useState(plan?.concept ?? "");
  // Campos que a página simples não mostra mais: ficam guardados como estão.
  const kept = {
    mood: plan?.mood ?? "",
    palette: plan?.palette ?? [],
    moodPhrases: plan?.moodPhrases ?? [],
    goals: (plan?.goals ?? []).map((g) => ({ title: g.title, how: g.how ?? "" })),
    highlight: plan?.highlight ?? null,
  };
  const [phases, setPhases] = useState(
    plan?.phases.length
      ? plan.phases.map((p) => ({ name: p.name, start: p.start, end: p.end, intent: p.intent ?? "", stories: p.stories ?? "" }))
      : [{ name: "", start: first, end: last, intent: "", stories: "" }],
  );
  const [needs, setNeeds] = useState(plan?.needs.map((n) => ({ text: n.text, due: n.due ?? "", done: n.done })) ?? []);
  const [pieces, setPieces] = useState(
    data.pieces
      .filter((p) => p.inPlan || p.status !== "publicado")
      .map((p) => ({ contentId: p._id as Id<"contents">, title: p.title, date: p.date, format: p.format, hook: p.hook ?? "", about: p.about ?? "", note: p.note ?? "", essential: p.essential, inPlan: p.inPlan })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await save({
        slug,
        month,
        theme,
        concept,
        ...kept,
        highlight: kept.highlight ? { title: kept.highlight.title, text: kept.highlight.text ?? undefined, pillar: kept.highlight.pillar } : null,
        phases,
        needs,
        pieces: pieces.filter((p) => p.inPlan).map(({ contentId, hook, about, note, essential }) => ({ contentId, hook, about, note, essential })),
      });
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="titulo text-5xl md:text-6xl">Plano de {monthName(month).toLowerCase()}</h1>
        <p className="text-base text-texto-2">
          As peças vêm do calendário. Aqui você escreve o tema, o caminho em fases e o que precisa da cliente. Ela só vê depois que você enviar.
        </p>
      </div>

      <section className={box} aria-labelledby="ed-capa">
        <h2 id="ed-capa" className="text-lg font-bold">
          Capa
        </h2>
        <label className={label}>
          Tema do mês (a frase grande)
          <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Ex.: Novembro decide o dezembro." className={field} />
        </label>
        <label className={label}>
          Conceito
          <textarea rows={3} value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Em duas ou três frases: o que o mês quer e como chega lá." className={area} />
        </label>
      </section>


      <section className={box} aria-labelledby="ed-fases">
        <h2 id="ed-fases" className="text-lg font-bold">
          Fases do caminho
        </h2>
        <p className="-mt-2 text-sm text-texto-2">Cada post cai na fase pela data.</p>
        {phases.map((p, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl bg-creme p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
              <label className={label}>
                Fase {i + 1}
                <input value={p.name} onChange={(e) => setPhases((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Ex.: Desejo" className={field} />
              </label>
              <label className={label}>
                De
                <input type="date" min={first} max={last} value={p.start} onChange={(e) => setPhases((l) => l.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className={`${field} appearance-none`} />
              </label>
              <label className={label}>
                Até
                <input type="date" min={first} max={last} value={p.end} onChange={(e) => setPhases((l) => l.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className={`${field} appearance-none`} />
              </label>
            </div>
            <label className={label}>
              O que a fase faz
              <textarea rows={2} value={p.intent} onChange={(e) => setPhases((l) => l.map((x, j) => (j === i ? { ...x, intent: e.target.value } : x)))} className={area} />
            </label>
            <button type="button" onClick={() => setPhases((l) => l.filter((_, j) => j !== i))} className={small}>
              Tirar fase
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setPhases((l) => [...l, { name: "", start: first, end: last, intent: "", stories: "" }])} className={small}>
          + Fase
        </button>
      </section>


      <section className={box} aria-labelledby="ed-posts">
        <h2 id="ed-posts" className="text-lg font-bold">
          Posts do mês ({pieces.filter((p) => p.inPlan).length} no plano)
        </h2>
        <p className="-mt-2 text-sm text-texto-2">
          Só os marcados em &ldquo;No plano&rdquo; aparecem para a cliente; posts já postados ficam de fora. A frase da capa vira o rascunho enquanto não há arte. A ideia aparece em &ldquo;Ver a ideia&rdquo;. Para mudar data, formato ou pilar, edite a peça no calendário.
        </p>
        {pieces.length === 0 && <p className="text-sm text-texto-2">Nenhuma peça no calendário deste mês ainda.</p>}
        {pieces.map((p, i) => (
          <div key={p.contentId} className="flex flex-col gap-3 rounded-xl bg-creme p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-[15px]">
                {dayLabel(p.date)} · {FORMAT[p.format]} · {p.title}
              </strong>
              <span className="flex flex-wrap gap-4">
              <label className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={p.inPlan} onChange={(e) => setPieces((l) => l.map((x, j) => (j === i ? { ...x, inPlan: e.target.checked } : x)))} className="size-[18px] accent-rosa-forte" />
                No plano
              </label>
              <label className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={p.essential} onChange={(e) => setPieces((l) => l.map((x, j) => (j === i ? { ...x, essential: e.target.checked } : x)))} className="size-[18px] accent-rosa-forte" />
                Essencial
              </label>
              </span>
            </div>
            <label className={label}>
              Frase da capa
              <input value={p.hook} onChange={(e) => setPieces((l) => l.map((x, j) => (j === i ? { ...x, hook: e.target.value } : x)))} className={field} />
            </label>
            <label className={label}>
              Do que o post fala (aparece direto para a cliente)
              <textarea rows={2} value={p.about} onChange={(e) => setPieces((l) => l.map((x, j) => (j === i ? { ...x, about: e.target.value } : x)))} className={area} />
            </label>
            <label className={label}>
              Roteiro (abre em &ldquo;Ver o roteiro&rdquo;)
              <textarea rows={2} value={p.note} onChange={(e) => setPieces((l) => l.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} className={area} />
            </label>
          </div>
        ))}
      </section>

      <section className={box} aria-labelledby="ed-needs">
        <h2 id="ed-needs" className="text-lg font-bold">
          O que preciso da cliente
        </h2>
        {needs.map((n, i) => (
          <div key={i} className="grid grid-cols-1 gap-3 rounded-xl bg-creme p-3 md:grid-cols-[1.6fr_0.6fr_auto] md:items-end">
            <label className={label}>
              Pendência
              <input value={n.text} onChange={(e) => setNeeds((l) => l.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} className={field} />
            </label>
            <label className={label}>
              Prazo
              <input value={n.due} onChange={(e) => setNeeds((l) => l.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} placeholder="Até 14/11" className={field} />
            </label>
            <button type="button" onClick={() => setNeeds((l) => l.filter((_, j) => j !== i))} className={small}>
              Tirar
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setNeeds((l) => [...l, { text: "", due: "", done: false }])} className={small}>
          + Pendência
        </button>
      </section>

      {error && (
        <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">
          {error}
        </p>
      )}
      <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 flex gap-3 rounded-full bg-creme/95 py-2 md:bottom-4">
        <button type="button" disabled={busy} onClick={() => void submit()} className={buttonClass.primary}>
          {busy ? "Salvando…" : "Salvar plano"}
        </button>
        <button type="button" onClick={onDone} className={buttonClass.outline}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
