"use client";

import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { StatusTag } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { STATUS, type Status } from "@/lib/labels";

const ORDER: Status[] = ["ideia", "producao", "aguardando", "ajuste", "aprovado", "agendado", "publicado"];
const MENU_W = 220;

/**
 * Etiqueta de status que, para a admin, vira um botão: um toque abre a lista
 * e muda o status na hora, sem abrir o editor. Para o cliente é só a etiqueta.
 * Fica fora de <Link> (botão dentro de link não é HTML válido).
 */
export function StatusMenu({
  contentId,
  status,
  editable,
  short = false,
  className = "",
}: {
  contentId: Id<"contents">;
  status: Status;
  editable: boolean;
  short?: boolean;
  className?: string;
}) {
  const setStatus = useMutation(api.contents.setStatus);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [busy, setBusy] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      if (e.type === "pointerdown" && (menu.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node))) return;
      setPos(null);
      if (e.type === "keydown") btn.current?.focus();
    };
    // Rolagem fecha para o menu não ficar solto longe da etiqueta.
    const onScroll = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) setPos(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    menu.current?.querySelector<HTMLButtonElement>("[aria-checked=true]")?.focus();
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  if (!editable) return <StatusTag status={status} short={short} className={className} />;

  function open() {
    if (pos) return setPos(null);
    const r = btn.current!.getBoundingClientRect();
    const height = 44 * ORDER.length + 16;
    const below = r.bottom + 6 + height <= window.innerHeight;
    setError(null);
    setPos({
      top: below ? r.bottom + 6 : Math.max(8, r.top - 6 - height),
      left: Math.min(Math.max(8, r.left), window.innerWidth - MENU_W - 8),
    });
  }

  async function pick(next: Status) {
    if (next === status) return setPos(null);
    setBusy(next);
    setError(null);
    try {
      await setStatus({ contentId, status: next });
      setPos(null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={open}
        aria-haspopup="menu"
        aria-expanded={pos !== null}
        aria-label={`Status: ${STATUS[status].label}. Mudar status`}
        className="-mx-1.5 -my-1 inline-flex min-h-8 items-center gap-1 self-start rounded-full px-1.5 py-1 hover:bg-rosa/40 focus-visible:outline-2 focus-visible:outline-rosa-forte"
      >
        <StatusTag status={status} short={short} className={className} />
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" className="shrink-0 text-texto-2">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {pos && (
        <div
          ref={menu}
          role="menu"
          aria-label="Mudar status"
          className="fixed z-50 flex flex-col rounded-2xl border border-linha bg-white p-2 shadow-[0_12px_32px_rgba(92,15,49,0.18)]"
          style={{ top: pos.top, left: pos.left, width: MENU_W }}
        >
          {ORDER.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={s === status}
              disabled={busy !== null}
              onClick={() => pick(s)}
              className={`flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-left text-sm text-vinho hover:bg-creme focus-visible:bg-creme focus-visible:outline-none disabled:opacity-60 ${s === status ? "bg-creme" : ""}`}
            >
              <StatusTag status={s} className="text-sm" />
              {busy === s ? (
                <span className="text-xs text-texto-2">Salvando</span>
              ) : s === status ? (
                <span aria-hidden="true" className="font-bold text-rosa-forte">✓</span>
              ) : null}
            </button>
          ))}
          {error && (
            <p role="alert" className="px-3 pb-1 pt-2 text-xs leading-snug text-st-ajuste-texto">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  );
}
