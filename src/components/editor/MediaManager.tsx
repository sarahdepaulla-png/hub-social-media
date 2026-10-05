"use client";

import { useMutation } from "convex/react";
import { useRef, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { MediaItem } from "@/components/content/MediaViewer";
import { errorText } from "@/components/content/DecisionSheet";

const MAX_BYTES = 100 * 1024 * 1024;

/** Upload, ordem e remoção dos cards da versão atual. */
export function MediaManager({ contentId, media, version }: { contentId: Id<"contents">; media: MediaItem[]; version: number }) {
  const uploadUrl = useMutation(api.media.generateUploadUrl);
  const add = useMutation(api.media.add);
  const remove = useMutation(api.media.remove);
  const move = useMutation(api.media.move);
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [dragging, setDragging] = useState(false);

  const upload = async (files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files);
    const tooBig = list.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) {
      setError(`${tooBig.map((f) => f.name).join(", ")} passa de 100 MB. Suba no Drive ou Vimeo e cole o link.`);
    }
    const ok = list.filter((f) => f.size <= MAX_BYTES && (f.type.startsWith("image/") || f.type.startsWith("video/")));
    for (const [i, file] of ok.entries()) {
      setProgress(`Enviando ${i + 1} de ${ok.length}: ${file.name}`);
      try {
        const url = await uploadUrl();
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        if (!res.ok) throw new Error(`Falha no envio (${res.status})`);
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        await add({ contentId, storageId, kind: file.type.startsWith("video/") ? "video" : "imagem" });
      } catch (err) {
        setError(err instanceof Error && !("data" in err) ? `${file.name}: ${err.message}` : errorText(err));
      }
    }
    setProgress(null);
    if (input.current) input.current.value = "";
  };

  const addLink = async (e: FormEvent) => {
    e.preventDefault();
    const url = link.trim();
    if (!/^https?:\/\//.test(url)) {
      setError("Cole um link completo, começando com https://");
      return;
    }
    try {
      await add({ contentId, url, kind: /\.(mp4|mov|webm)(\?|$)/i.test(url) ? "video" : "link" });
      setLink("");
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <section aria-label="Mídia" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-extrabold tracking-[-0.04em]">Mídia da versão {version}</h2>
        <span className="text-sm text-texto-2">{media.length} {media.length === 1 ? "card" : "cards"}</span>
      </div>

      {media.length > 0 && (
        <ol className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {media.map((m, i) => (
            <li key={m._id} className="flex flex-col gap-1.5">
              <span className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-thumb">
                {m.kind === "imagem" && m.url && <img src={m.url} alt="" className="size-full object-cover" />}
                {m.kind === "video" && m.url && <video src={m.url} muted playsInline preload="metadata" className="size-full object-cover" />}
                {m.kind === "link" && <span className="flex size-full items-center justify-center p-2 text-center text-xs">Link externo</span>}
                <span className="absolute left-1.5 top-1.5 rounded-full bg-vinho px-2 text-xs font-bold leading-5 text-white">{i + 1}</span>
              </span>
              <span className="flex justify-between">
                <button type="button" aria-label={`Mover card ${i + 1} para a esquerda`} disabled={i === 0} onClick={() => move({ mediaId: m._id as Id<"media">, direction: -1 })} className="size-9 rounded-full text-lg disabled:opacity-25">
                  ‹
                </button>
                <button type="button" aria-label={`Remover card ${i + 1}`} onClick={() => remove({ mediaId: m._id as Id<"media"> }).catch((e) => setError(errorText(e)))} className="min-h-9 px-1 text-xs font-semibold text-st-ajuste-texto">
                  Remover
                </button>
                <button type="button" aria-label={`Mover card ${i + 1} para a direita`} disabled={i === media.length - 1} onClick={() => move({ mediaId: m._id as Id<"media">, direction: 1 })} className="size-9 rounded-full text-lg disabled:opacity-25">
                  ›
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center gap-1.5 border-[1.5px] border-dashed p-6 text-center transition-colors ${
          dragging ? "border-rosa-forte bg-white" : "border-campo"
        }`}
      >
        <strong className="text-[15px]">{progress ?? "Solte imagens ou vídeos aqui, ou toque para escolher"}</strong>
        <span className="text-[13px] text-texto-2">JPG, PNG, MP4 até 100 MB. Entram na ordem em que você escolher.</span>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/*,video/*"
          className="sr-only"
          disabled={!!progress}
          onChange={(e) => e.target.files && void upload(e.target.files)}
        />
      </label>

      <form onSubmit={addLink} className="flex gap-2">
        <label className="sr-only" htmlFor="link-midia">Link externo</label>
        <input
          id="link-midia"
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Ou cole um link (Drive, Vimeo, Canva)"
          className="min-h-11 min-w-0 flex-1 border border-campo bg-white px-3 text-[15px]"
        />
        <button type="submit" className="min-h-11 rounded-full border-[1.5px] border-vinho px-4 text-sm font-semibold">
          Adicionar
        </button>
      </form>
      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
    </section>
  );
}
