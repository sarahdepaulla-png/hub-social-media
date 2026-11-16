"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorText } from "@/components/content/DecisionSheet";

/**
 * Salva sozinho: espera a pessoa parar de digitar (1,5 s) e grava.
 * Também grava ao sair da página ou fechar o formulário, para nada se perder.
 */
export function useAutosave<T>(value: T, save: (v: T) => Promise<unknown>, { enabled = true, delay = 1500 }: { enabled?: boolean; delay?: number } = {}) {
  const key = JSON.stringify(value);
  const [savedKey, setSavedKey] = useState(key);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const latest = useRef({ value, key, save, enabled, savedKey });
  useEffect(() => {
    latest.current = { value, key, save, enabled, savedKey };
  });
  const running = useRef<Promise<unknown> | null>(null);

  /** Grava agora o que estiver diferente do último salvo. */
  const flush = useCallback(async () => {
    if (running.current) await running.current.catch(() => undefined);
    const { value: v, key: k, save: s, savedKey: done } = latest.current;
    if (k === done) return;
    setSaving(true);
    setError(null);
    const p = s(v);
    running.current = p;
    try {
      await p;
      latest.current.savedKey = k;
      setSavedKey(k);
      setSavedAt(Date.now());
    } catch (e) {
      setError(errorText(e));
      throw e;
    } finally {
      running.current = null;
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || key === savedKey) return;
    const t = setTimeout(() => void flush().catch(() => undefined), delay);
    return () => clearTimeout(t);
  }, [key, savedKey, enabled, delay, flush]);

  // Saiu da página, trocou de aba ou fechou o formulário: grava o que faltou.
  useEffect(() => {
    const pending = () => latest.current.enabled && latest.current.key !== latest.current.savedKey;
    const onHide = () => {
      if (document.visibilityState === "hidden" && pending()) void flush().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (pending()) void flush().catch(() => undefined);
    };
  }, [flush]);

  const dirty = key !== savedKey;
  return { flush, saving, dirty, savedAt, error };
}

/** Texto curto do estado: "Salvando…", "Salvo automaticamente às 14:32". */
export function autosaveText(s: { saving: boolean; dirty: boolean; savedAt: number | null; error: string | null }, enabled = true) {
  if (s.error) return `Não salvou: ${s.error}`;
  if (s.saving || (s.dirty && enabled)) return "Salvando…";
  if (s.savedAt) {
    const d = new Date(s.savedAt);
    return `Salvo automaticamente às ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return "Salva sozinho enquanto você escreve";
}
