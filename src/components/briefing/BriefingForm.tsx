"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { buttonClass } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { FORMAT, PLATFORM, type Format, type Platform } from "@/lib/labels";

export const field = "min-h-12 w-full border-[1.5px] border-campo bg-white px-3 text-base font-normal text-vinho";

export type BriefingValues = {
  title: string;
  platform?: Platform;
  format?: Format;
  desiredDate?: string;
  objective?: string;
  body: string;
  links: string[];
};

const OBJECTIVES = ["Educar", "Engajar", "Vender", "Mostrar bastidores", "Autoridade", "Divulgar data ou evento"];

/** Uma etapa numerada da esteira: número grande, título e o conteúdo. */
export function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-3 border-t border-linha pt-6 md:grid-cols-[72px_minmax(0,1fr)]">
      <span aria-hidden="true" className="text-[44px] font-extrabold leading-[0.8] tracking-[-0.06em] text-rosa md:text-[64px]">
        {n}
      </span>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.04em]">{title}</h2>
          {hint && <p className="text-sm text-texto-2">{hint}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Formulário do briefing em 3 etapas: o que é, o briefing, os links. */
export function BriefingForm({
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<BriefingValues>;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (v: BriefingValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const [links, setLinks] = useState<string[]>(initial?.links?.length ? initial.links : [""]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const text = (k: string) => String(d.get(k) ?? "").trim() || undefined;
    setPending(true);
    setError(null);
    try {
      await onSubmit({
        title: String(d.get("title") ?? ""),
        platform: (text("platform") as Platform | undefined) ?? undefined,
        format: (text("format") as Format | undefined) ?? undefined,
        desiredDate: text("desiredDate"),
        objective: text("objective"),
        body: String(d.get("body") ?? ""),
        links: links.map((l) => l.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(errorText(err));
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <Step n={1} title="O que é o conteúdo" hint="O tema em uma frase. Formato e data ajudam o estúdio a encaixar no calendário.">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Tema
          <input name="title" required maxLength={160} defaultValue={initial?.title ?? ""} placeholder="Ex.: 3 ajustes na cadeira do home office" className={field} />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Formato
            <select name="format" defaultValue={initial?.format ?? ""} className={field}>
              <option value="">O estúdio decide</option>
              {Object.entries(FORMAT).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Plataforma
            <select name="platform" defaultValue={initial?.platform ?? "instagram"} className={field}>
              <option value="">O estúdio decide</option>
              {Object.entries(PLATFORM).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Quando quer que saia
            <input name="desiredDate" type="date" defaultValue={initial?.desiredDate ?? ""} className={field} />
          </label>
        </div>
      </Step>

      <Step n={2} title="Briefing" hint="O que precisa ser dito, para quem, em que tom e o que não pode faltar (ou o que evitar).">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Objetivo
          <input name="objective" list="objetivos" defaultValue={initial?.objective ?? ""} placeholder="Escolha ou escreva" className={field} />
          <datalist id="objetivos">
            {OBJECTIVES.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          O briefing
          <textarea
            name="body"
            required
            rows={7}
            maxLength={6000}
            defaultValue={initial?.body ?? ""}
            placeholder={"Mensagem principal:\nPara quem:\nTom:\nNão pode faltar:\nEvitar:"}
            className={`${field} py-3 leading-relaxed`}
          />
        </label>
      </Step>

      <Step n={3} title="Links" hint="Referências, pasta com fotos ou vídeos brutos, o post que inspirou. Opcional.">
        <div className="flex flex-col gap-2">
          {links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <label className="sr-only" htmlFor={`link-${i}`}>Link {i + 1}</label>
              <input
                id={`link-${i}`}
                type="url"
                inputMode="url"
                value={l}
                onChange={(e) => setLinks((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder="https://"
                className={field}
              />
              {links.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLinks((arr) => arr.filter((_, j) => j !== i))}
                  aria-label={`Tirar link ${i + 1}`}
                  className="flex size-12 shrink-0 items-center justify-center rounded-full text-xl text-texto-2 hover:bg-white"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {links.length < 10 && (
            <button type="button" onClick={() => setLinks((arr) => [...arr, ""])} className="min-h-11 self-start text-[15px] font-semibold text-rosa-forte">
              Mais um link
            </button>
          )}
        </div>
      </Step>

      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
      <div className="flex flex-wrap gap-3 border-t border-linha pt-6">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? pendingLabel : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={buttonClass.outline}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
