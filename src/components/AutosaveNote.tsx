"use client";

import { autosaveText } from "@/lib/useAutosave";

/** Indicador discreto do salvamento automático. */
export function AutosaveNote({ state, enabled = true, className = "" }: { state: { saving: boolean; dirty: boolean; savedAt: number | null; error: string | null }; enabled?: boolean; className?: string }) {
  const tone = state.error ? "text-st-ajuste-texto font-semibold" : "text-texto-2";
  const dot = state.error ? "bg-st-ajuste" : state.saving || (state.dirty && enabled) ? "bg-st-aguardando animate-pulse" : "bg-st-aprovado";
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-2 text-sm ${tone} ${className}`}>
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
      {autosaveText(state, enabled)}
    </span>
  );
}
