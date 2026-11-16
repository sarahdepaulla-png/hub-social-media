"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { useAutosave } from "@/lib/useAutosave";
import { AutosaveNote } from "@/components/AutosaveNote";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { FORMAT, PLATFORM, type Format, type Platform } from "@/lib/labels";

type Fields = {
  date: string;
  time: string;
  platform: Platform;
  format: Format;
  title: string;
  objective: string;
  pillar: string;
  externalUrl: string;
};

const field = "min-h-11 border border-campo bg-white px-3 text-[15px] font-normal";

/** Ficha da peça: data, plataforma, formato, tema, objetivo, pilar, link. */
export function ContentForm({ contentId, initial }: { contentId: Id<"contents">; initial: Fields }) {
  const update = useMutation(api.contents.update);
  const [f, setF] = useState(initial);
  const set = (patch: Partial<Fields>) => setF((p) => ({ ...p, ...patch }));
  // Data vazia não grava (o campo de data fica vazio enquanto a pessoa troca o dia).
  const auto = useAutosave(
    f,
    (v) =>
      update({
        contentId,
        date: v.date,
        time: v.time || undefined,
        platform: v.platform,
        format: v.format,
        title: v.title.trim() || "Sem título",
        objective: v.objective,
        pillar: v.pillar,
        externalUrl: v.externalUrl,
      }),
    { enabled: /^\d{4}-\d{2}-\d{2}$/.test(f.date) },
  );
  const submit = () => void auto.flush().catch(() => undefined);

  return (
    <section aria-label="Ficha" className="flex flex-col gap-4">
      <h2 className="text-xl font-extrabold tracking-[-0.04em]">Ficha</h2>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        Tema
        <input value={f.title} onChange={(e) => set({ title: e.target.value })} className={`${field} text-lg font-bold`} />
      </label>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Data
          <input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Horário
          <input type="time" value={f.time} onChange={(e) => set({ time: e.target.value })} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Plataforma
          <select value={f.platform} onChange={(e) => set({ platform: e.target.value as Platform })} className={field}>
            {Object.entries(PLATFORM).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Formato
          <select value={f.format} onChange={(e) => set({ format: e.target.value as Format })} className={field}>
            {Object.entries(FORMAT).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Objetivo
          <input value={f.objective} onChange={(e) => set({ objective: e.target.value })} placeholder="Ex.: salvamentos" className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Pilar editorial
          <input value={f.pillar} onChange={(e) => set({ pillar: e.target.value })} placeholder="Ex.: educação prática" className={field} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        Link externo da peça (opcional)
        <input type="url" value={f.externalUrl} onChange={(e) => set({ externalUrl: e.target.value })} placeholder="https://" className={field} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={auto.saving}
          className="min-h-11 rounded-full bg-vinho px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Salvar ficha
        </button>
        <AutosaveNote state={auto} />
      </div>
    </section>
  );
}
