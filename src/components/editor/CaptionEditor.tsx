"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { errorText } from "@/components/content/DecisionSheet";

type Caption = { _id: string; order: number; text: string; cta: string | null; hashtags: string | null; notes: string | null; chosen: boolean };
type Draft = { _id?: Id<"captions">; text: string; cta: string; hashtags: string; notes: string; chosen: boolean };

const field = "border border-campo bg-white px-3 text-[15px] font-normal";

/** Opções de legenda com CTA, hashtags e observação em cada uma. */
export function CaptionEditor({ contentId, captions }: { contentId: Id<"contents">; captions: Caption[] }) {
  const save = useMutation(api.captions.save);
  const [items, setItems] = useState<Draft[]>(() =>
    captions.length
      ? captions.map((c) => ({ _id: c._id as Id<"captions">, text: c.text, cta: c.cta ?? "", hashtags: c.hashtags ?? "", notes: c.notes ?? "", chosen: c.chosen }))
      : [{ text: "", cta: "", hashtags: "", notes: "", chosen: false }],
  );
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const set = (i: number, patch: Partial<Draft>) => {
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
    setState("idle");
  };

  const submit = async () => {
    setState("saving");
    setError(null);
    try {
      await save({
        contentId,
        items: items.map(({ _id, text, cta, hashtags, notes }) => ({ _id, text, cta, hashtags, notes })),
      });
      setState("saved");
    } catch (err) {
      setError(errorText(err));
      setState("idle");
    }
  };

  return (
    <section aria-label="Legendas" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-extrabold tracking-[-0.04em]">Opções de legenda</h2>
        <button
          type="button"
          onClick={() => setItems((p) => [...p, { text: "", cta: p.at(-1)?.cta ?? "", hashtags: p.at(-1)?.hashtags ?? "", notes: "", chosen: false }])}
          className="min-h-11 text-[15px] font-semibold text-rosa-forte"
        >
          Adicionar opção
        </button>
      </div>

      {items.map((it, i) => (
        <fieldset key={it._id ?? `novo-${i}`} className={`flex flex-col gap-3 rounded-peca border-2 bg-white p-4 ${it.chosen ? "border-vinho" : "border-linha"}`}>
          <legend className="sr-only">Opção {i + 1}</legend>
          <div className="flex items-center justify-between">
            <strong className="text-sm">
              Opção {i + 1}
              {it.chosen && <span className="font-medium text-rosa-forte"> (escolhida pela cliente)</span>}
            </strong>
            {items.length > 1 && (
              <button type="button" onClick={() => setItems((p) => p.filter((_, j) => j !== i))} className="min-h-9 text-sm font-semibold text-st-ajuste-texto">
                Remover
              </button>
            )}
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Texto
            <textarea rows={4} value={it.text} onChange={(e) => set(i, { text: e.target.value })} className={`${field} resize-y py-2.5 leading-relaxed`} />
          </label>
          {/* CTA e hashtags em caixa que cresce com o texto: nada fica escondido no fim da linha. */}
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            CTA
            <textarea rows={2} value={it.cta} onChange={(e) => set(i, { cta: e.target.value })} className={`${field} field-sizing-content min-h-11 resize-y py-2.5 leading-relaxed`} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Hashtags
            <textarea rows={1} value={it.hashtags} onChange={(e) => set(i, { hashtags: e.target.value })} className={`${field} field-sizing-content min-h-11 resize-y py-2.5 leading-relaxed`} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Observação para a cliente
            <textarea rows={1} value={it.notes} onChange={(e) => set(i, { notes: e.target.value })} className={`${field} field-sizing-content min-h-11 resize-y py-2.5 leading-relaxed`} />
          </label>
        </fieldset>
      ))}

      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={state === "saving"}
        className="min-h-11 self-start rounded-full bg-vinho px-5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {state === "saving" ? "Salvando" : state === "saved" ? "Legendas salvas" : "Salvar legendas"}
      </button>
    </section>
  );
}
