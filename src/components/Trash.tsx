"use client";

import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { errorText } from "@/components/content/DecisionSheet";

/* Aviso "foi para a lixeira. Desfazer": fica na tela mesmo depois que o card some. */
type Notice = { id: Id<"contents">; title: string; key: number };
let listeners: ((n: Notice) => void)[] = [];
function announce(n: Notice) {
  for (const l of listeners) l(n);
}

export function TrashToastHost() {
  const restore = useMutation(api.contents.restore);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const l = (n: Notice) => setNotice(n);
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!notice) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[92px] z-[60] mx-auto flex max-w-md items-center justify-between gap-4 rounded-2xl bg-vinho px-4 py-3 text-sm text-white shadow-[0_12px_32px_rgba(92,15,49,0.35)] md:bottom-6"
    >
      <span className="min-w-0">
        <span className="block truncate font-semibold">&ldquo;{notice.title}&rdquo;</span>
        foi para a lixeira. Fica lá por 15 dias.
      </span>
      <button
        type="button"
        onClick={() => {
          restore({ contentId: notice.id });
          setNotice(null);
        }}
        className="min-h-10 shrink-0 rounded-full bg-rosa px-4 font-bold text-vinho"
      >
        Desfazer
      </button>
    </div>
  );
}

function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 008.5 21h7a1.5 1.5 0 001.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V7" />
    </svg>
  );
}

/**
 * Lixeira da peça. Só aparece para a admin.
 * `reveal`: no computador some até passar o mouse no card (o card precisa ter a classe `group/peca`).
 */
export function TrashButton({
  contentId,
  title,
  editable,
  reveal = false,
  variant = "icon",
  className = "",
  onDone,
}: {
  contentId: Id<"contents">;
  title: string;
  editable: boolean;
  reveal?: boolean;
  variant?: "icon" | "text";
  className?: string;
  onDone?: () => void;
}) {
  const trash = useMutation(api.contents.trash);
  const [busy, setBusy] = useState(false);
  if (!editable) return null;

  const run = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      await trash({ contentId });
      announce({ id: contentId, title, key: Date.now() });
      onDone?.();
    } catch (err) {
      window.alert(errorText(err));
      setBusy(false);
    }
  };

  if (variant === "text") {
    return (
      <button type="button" onClick={run} disabled={busy} className={`inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-st-ajuste-texto disabled:opacity-50 ${className}`}>
        <TrashIcon /> Mandar para a lixeira
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      draggable={false}
      aria-label={`Mandar "${title}" para a lixeira`}
      title="Mandar para a lixeira"
      className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-white/95 text-st-ajuste-texto shadow-sm hover:bg-st-ajuste hover:text-white focus-visible:opacity-100 disabled:opacity-50 ${
        reveal ? "md:opacity-0 md:group-hover/peca:opacity-100" : ""
      } ${className}`}
    >
      <TrashIcon />
    </button>
  );
}
