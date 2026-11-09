"use client";

import { useMutation } from "convex/react";
import { useRef, useState } from "react";
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
  const uploadUrl = useMutation(api.plans.generateUploadUrl);
  const addImage = useMutation(api.plans.addMoodImage);
  const removeImage = useMutation(api.plans.removeMoodImage);
  const plan = data.plan;
  const { first, last } = monthBounds(month);
  const fileRef = useRef<HTMLInputElement>(null);

  const [theme, setTheme] = useState(plan?.theme ?? "");
  const [concept, setConcept] = useState(plan?.concept ?? "");
  const [mood, setMood] = useState(plan?.mood ?? "");
  const [palette, setPalette] = useState((plan?.palette ?? []).join(", "));
  const [phrases, setPhrases] = useState((plan?.moodPhrases ?? []).join("\n"));
  const [goals, setGoals] = useState(plan?.goals.length ? plan.goals.map((g) => ({ title: g.title, how: g.how ?? "" })) : [{ title: "", how: "" }]);
  const [phases, setPhases] = useState(
    plan?.phases.length
      ? plan.phases.map((p) => ({ name: p.name, start: p.start, end: p.end, intent: p.intent ?? "", stories: p.stories ?? "" }))
      : [{ name: "", start: first, end: last, intent: "", stories: "" }],
  );
  const [hl, setHl] = useState({ title: plan?.highlight?.title ?? "", text: plan?.highlight?.text ?? "", pillar: plan?.highlight?.pillar ?? "" });
  const [needs, setNeeds] = useState(plan?.needs.map((n) => ({ text: n.text, due: n.due ?? "", done: n.done })) ?? []);
  const [pieces, setPieces] = useState(
    data.pieces
      .filter((p) => p.inPlan || p.status !== "publicado")
      .map((p) => ({ contentId: p._id as Id<"contents">, title: p.title, date: p.date, format: p.format, hook: p.hook ?? "", note: p.note ?? "", essential: p.essential, inPlan: p.inPlan })),
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pillars = [...new Set(data.pieces.map((p) => p.pillar).filter((p): p is string => !!p))];

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await save({
        slug,
        month,
        theme,
        concept,
        mood,
        palette: palette.split(/[\s,;]+/).filter(Boolean).map((c) => (c.startsWith("#") ? c : `#${c}`)),
        moodPhrases: phrases.split("\n"),
        goals,
        phases,
        highlight: hl.title.trim() && hl.pillar ? hl : null,
        needs,
        pieces: pieces.filter((p) => p.inPlan).map(({ contentId, hook, note, essential }) => ({ contentId, hook, note, essential })),
      });
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const url = await uploadUrl();
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        await addImage({ slug, month, storageId });
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="titulo text-5xl md:text-6xl">Plano de {monthName(month).toLowerCase()}</h1>
        <p className="text-base text-texto-2">
          As peças vêm do calendário. Aqui você escreve a estratégia: tema, objetivos, fases e o que precisa da cliente. Ela só vê depois que você enviar.
        </p>
      </div>

      <section className={box} aria-labelledby="ed-capa">
        <h2 id="ed-capa" className="text-lg font-bold">
          Capa e moodboard
        </h2>
        <label className={label}>
          Tema do mês (a frase grande)
          <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Ex.: Novembro decide o dezembro." className={field} />
        </label>
        <label className={label}>
          Conceito
          <textarea rows={3} value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Em duas ou três frases: o que o mês quer e como chega lá." className={area} />
        </label>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={label}>
            Clima em poucas palavras
            <input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="Ex.: delicado, festivo, sem vermelho e verde" className={field} />
          </label>
          <label className={label}>
            Paleta (cores em hex, separadas por vírgula)
            <input value={palette} onChange={(e) => setPalette(e.target.value)} placeholder="#3B2A26, #B8925A, #D8A7A0" className={field} />
          </label>
        </div>
        <label className={label}>
          Frases do moodboard (uma por linha)
          <textarea rows={3} value={phrases} onChange={(e) => setPhrases(e.target.value)} className={area} />
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Imagens do moodboard</span>
          <div className="flex flex-wrap gap-2.5">
            {(plan?.moodImages ?? []).map((m) => (
              <span key={m.id} className="relative">
                {m.url && <img src={m.url} alt="" className="h-24 w-20 rounded-lg object-cover" />}
                <button
                  type="button"
                  onClick={() => void removeImage({ slug, month, storageId: m.id })}
                  aria-label="Tirar imagem"
                  className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-vinho text-sm font-bold text-white"
                >
                  ×
                </button>
              </span>
            ))}
            <button type="button" onClick={() => fileRef.current?.click()} className="flex h-24 w-20 items-center justify-center rounded-lg border-[1.5px] border-dashed border-campo text-sm font-semibold text-rosa-forte">
              {uploading ? "Subindo…" : "+ Imagem"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.target.files)} />
          </div>
        </div>
      </section>

      <section className={box} aria-labelledby="ed-obj">
        <h2 id="ed-obj" className="text-lg font-bold">
          Objetivos
        </h2>
        {goals.map((g, i) => (
          <div key={i} className="grid grid-cols-1 gap-3 rounded-xl bg-creme p-3 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
            <label className={label}>
              Objetivo {i + 1}
              <input value={g.title} onChange={(e) => setGoals((l) => l.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className={field} />
            </label>
            <label className={label}>
              Como medimos
              <input value={g.how} onChange={(e) => setGoals((l) => l.map((x, j) => (j === i ? { ...x, how: e.target.value } : x)))} className={field} />
            </label>
            <button type="button" onClick={() => setGoals((l) => l.filter((_, j) => j !== i))} className={small}>
              Tirar
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setGoals((l) => [...l, { title: "", how: "" }])} className={small}>
          + Objetivo
        </button>
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
            <label className={label}>
              Stories (uma ideia por linha)
              <textarea rows={2} value={p.stories} onChange={(e) => setPhases((l) => l.map((x, j) => (j === i ? { ...x, stories: e.target.value } : x)))} className={area} />
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

      <section className={box} aria-labelledby="ed-dest">
        <h2 id="ed-dest" className="text-lg font-bold">
          Destaque do mês (opcional)
        </h2>
        <p className="-mt-2 text-sm text-texto-2">Um fio de posts de um pilar, com seção própria (ex.: o espaço novo).</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className={label}>
            Título
            <input value={hl.title} onChange={(e) => setHl({ ...hl, title: e.target.value })} placeholder="Ex.: As quintas do espaço novo" className={field} />
          </label>
          <label className={label}>
            Pilar dos posts
            <select value={hl.pillar} onChange={(e) => setHl({ ...hl, pillar: e.target.value })} className={field}>
              <option value="">Sem destaque</option>
              {pillars.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={label}>
          Texto
          <textarea rows={2} value={hl.text} onChange={(e) => setHl({ ...hl, text: e.target.value })} className={area} />
        </label>
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
              A ideia
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
