"use client";

import { useEffect, useRef, useState } from "react";

export type LightboxItem = { url: string; kind: "imagem" | "video" };

function extFrom(url: string, type: string, kind: LightboxItem["kind"]) {
  const fromType = type.split("/")[1]?.split(";")[0];
  if (fromType && /^[a-z0-9]{2,5}$/.test(fromType)) return fromType === "jpeg" ? "jpg" : fromType === "quicktime" ? "mov" : fromType;
  const m = url.split("?")[0].match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toLowerCase() : kind === "video" ? "mp4" : "jpg";
}

function slug(text: string) {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "peca"
  );
}

/**
 * Foto ou vídeo em tela cheia, no tamanho original.
 * Setas passam os cards e "Baixar em alta" salva o arquivo exatamente como foi enviado.
 */
export function Lightbox({ items, start, title, onClose }: { items: LightboxItem[]; start: number; title: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(start);
  const [saving, setSaving] = useState(false);
  const item = items[i];

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const go = (d: number) => setI((n) => Math.max(0, Math.min(items.length - 1, n + d)));

  const download = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const res = await fetch(item.url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug(title)}-card-${i + 1}.${extFrom(item.url, blob.type, item.kind)}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch {
      // Sem baixar direto: abre o original em outra aba (dá para salvar de lá).
      window.open(item.url, "_blank", "noopener");
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      aria-label={`${title}, card ${i + 1} de ${items.length}`}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/95 p-0 text-white backdrop:bg-black/80"
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0 truncate text-sm font-semibold">
            {title}
            {items.length > 1 && <span className="font-normal text-white/70">, card {i + 1} de {items.length}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void download()}
              disabled={saving}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-black hover:bg-white/90 disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
              {saving ? "Baixando" : "Baixar em alta"}
            </button>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Fechar" className="flex size-10 items-center justify-center rounded-full text-2xl hover:bg-white/10">
              ×
            </button>
          </span>
        </div>

        <div onClick={(e) => e.target === e.currentTarget && ref.current?.close()} className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-16">
          {item.kind === "video" ? (
            <video key={item.url} src={item.url} controls autoPlay playsInline className="max-h-full max-w-full" />
          ) : (
            <img key={item.url} src={item.url} alt={`Card ${i + 1}`} className="max-h-full max-w-full object-contain" />
          )}
          {items.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Card anterior"
                onClick={() => go(-1)}
                disabled={i === 0}
                className="absolute left-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-0"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
              </button>
              <button
                type="button"
                aria-label="Próximo card"
                onClick={() => go(1)}
                disabled={i === items.length - 1}
                className="absolute right-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-0"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

/** Só imagem e vídeo com endereço entram na tela cheia (link externo abre o site). */
export function lightboxItems(media: { kind: string; url: string | null }[]) {
  return media
    .map((m, index) => ({ index, url: m.url, kind: m.kind }))
    .filter((m): m is { index: number; url: string; kind: "imagem" | "video" } => !!m.url && (m.kind === "imagem" || m.kind === "video"));
}
