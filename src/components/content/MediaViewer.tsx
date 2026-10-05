"use client";

import { useEffect, useRef, useState } from "react";
import { SelectionBox, Sticker } from "@/components/brand";
import type { Format, Status } from "@/lib/labels";

export type MediaItem = { _id: string; order: number; kind: "imagem" | "video" | "link"; url: string | null; alt: string | null };

const VERTICAL: Format[] = ["reels", "stories", "video"];

/**
 * Mostra a peça: carrossel com arraste e setas, vídeo tocando na página
 * ou link externo. O adesivo de aprovação e a caixa de ajuste ficam aqui.
 */
export function MediaViewer({
  media,
  format,
  status,
  externalUrl,
  justApproved = false,
  onIndexChange,
}: {
  media: MediaItem[];
  format: Format;
  status: Status;
  externalUrl: string | null;
  justApproved?: boolean;
  onIndexChange?: (i: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const vertical = VERTICAL.includes(format);
  const approved = status === "aprovado" || status === "agendado" || status === "publicado";

  useEffect(() => onIndexChange?.(index), [index, onIndexChange]);

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(media.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  const frame = vertical ? "aspect-[9/16] max-h-[78vh]" : "aspect-[4/5]";

  return (
    <div className="relative">
      <div className={`relative mx-auto w-full overflow-hidden bg-thumb md:rounded-peca ${frame}`}>
        {media.length === 0 ? (
          <div className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center text-texto-3">
            {externalUrl ? (
              <>
                <span className="text-lg font-bold">Esta peça está em um link externo</span>
                <a href={externalUrl} target="_blank" rel="noreferrer" className="min-h-11 content-center font-semibold text-rosa-forte underline">
                  Abrir em outra aba
                </a>
              </>
            ) : (
              <span className="text-base">O estúdio ainda está subindo a mídia.</span>
            )}
          </div>
        ) : (
          <div
            ref={track}
            onScroll={onScroll}
            tabIndex={0}
            role="region"
            aria-roledescription="carrossel"
            aria-label={media.length > 1 ? `Peça com ${media.length} cards` : "Peça"}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") go(index + 1);
              if (e.key === "ArrowLeft") go(index - 1);
            }}
            className="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {media.map((m, i) => (
              <div
                key={m._id}
                className="relative size-full shrink-0 snap-center"
                aria-roledescription="card"
                aria-label={`Card ${i + 1} de ${media.length}`}
              >
                {m.kind === "video" && m.url ? (
                  <video src={m.url} controls playsInline preload="metadata" className="size-full bg-vinho object-contain" />
                ) : m.kind === "link" && m.url ? (
                  <div className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center">
                    <span className="text-lg font-bold">Mídia em link externo</span>
                    <a href={m.url} target="_blank" rel="noreferrer" className="min-h-11 content-center break-all font-semibold text-rosa-forte underline">
                      Abrir link
                    </a>
                  </div>
                ) : m.url ? (
                  <img src={m.url} alt={m.alt ?? `Card ${i + 1}`} className="size-full object-cover" draggable={false} />
                ) : null}
              </div>
            ))}
          </div>
        )}

        {media.length > 1 && (
          <>
            <span className="absolute right-3 top-3 rounded-full bg-vinho px-2.5 py-1 text-[13px] font-semibold text-white" aria-live="polite">
              {index + 1} / {media.length}
            </span>
            <button
              type="button"
              aria-label="Card anterior"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-vinho disabled:opacity-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <button
              type="button"
              aria-label="Próximo card"
              onClick={() => go(index + 1)}
              disabled={index === media.length - 1}
              className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-vinho disabled:opacity-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
            </button>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden="true">
              {media.map((m, i) => (
                <span
                  key={m._id}
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: i === index ? 18 : 6, background: i === index ? "var(--color-vinho)" : "rgba(92,15,49,.35)" }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {approved && (
        <Sticker
          size={104}
          animate={justApproved}
          className="pointer-events-none absolute -top-4 right-2 md:-right-6"
          fill={status === "publicado" ? "var(--color-vinho)" : "var(--color-rosa)"}
          style={status === "publicado" ? { color: "white" } : undefined}
        >
          <span className={status === "publicado" ? "text-white" : ""}>{status === "publicado" ? "postado!" : "aprovado"}</span>
        </Sticker>
      )}
      {status === "ajuste" && (
        <span className="pointer-events-none absolute inset-1 md:-inset-2">
          <SelectionBox tone="ajuste" tilt={false} className="block size-full">
            <span className="sr-only">Ajuste solicitado</span>
          </SelectionBox>
        </span>
      )}
    </div>
  );
}

/** Barra de post do Instagram, para a cliente ver como fica no feed. */
export function PostBar() {
  return (
    <div aria-hidden="true" className="flex items-center justify-between bg-white px-5 py-3 md:rounded-b-peca">
      <span className="flex gap-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-vinho)" strokeWidth="2"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.2 3.1 4.5 6.9 4.5c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.8 0 6 3.7 4.5 7.3C19.5 16.4 12 21 12 21z" /></svg>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-vinho)" strokeWidth="2"><path d="M20.5 11.5a8.5 8.5 0 01-12.6 7.4L3.5 20l1.2-4.2A8.5 8.5 0 1120.5 11.5z" /></svg>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-vinho)" strokeWidth="2"><path d="M21 3L3 10.5l7 2.5 2.5 7z" /></svg>
      </span>
      <span className="text-xs text-texto-2">Prévia no feed</span>
      <svg width="22" height="24" viewBox="0 0 22 24" fill="none" stroke="var(--color-vinho)" strokeWidth="2"><path d="M4 3h14v18l-7-5-7 5z" /></svg>
    </div>
  );
}
