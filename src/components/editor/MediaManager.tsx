"use client";

import { useMutation } from "convex/react";
import { useRef, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { MediaItem } from "@/components/content/MediaViewer";
import { errorText } from "@/components/content/DecisionSheet";
import { linkHost } from "@/components/Linkify";
import { captureFrame, uploadToStorage } from "@/lib/videoFrame";

const MAX_BYTES = 100 * 1024 * 1024;

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;

/** Imagem, vídeo ou nada. Alguns celulares mandam o arquivo sem tipo: olha a extensão. */
function mediaKind(f: File): "imagem" | "video" | null {
  if (f.type.startsWith("image/") || (!f.type && IMAGE_EXT.test(f.name))) return "imagem";
  if (f.type.startsWith("video/") || (!f.type && VIDEO_EXT.test(f.name))) return "video";
  return null;
}

/** Sobe vários arquivos de uma vez para uma peça, na ordem escolhida. */
export function useMediaUpload() {
  const uploadUrl = useMutation(api.media.generateUploadUrl);
  const add = useMutation(api.media.add);
  const setCover = useMutation(api.media.setCover);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (contentId: Id<"contents">, files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files);
    const problems: string[] = [];
    const tooBig = list.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) problems.push(`${tooBig.map((f) => f.name).join(", ")} passa de 100 MB. Suba no Drive ou Vimeo e cole o link.`);
    const wrong = list.filter((f) => f.size <= MAX_BYTES && !mediaKind(f));
    if (wrong.length) problems.push(`${wrong.map((f) => f.name).join(", ")} não é imagem nem vídeo.`);
    const ok = list.filter((f) => f.size <= MAX_BYTES && mediaKind(f));
    for (const [i, file] of ok.entries()) {
      setProgress(ok.length > 1 ? `Enviando ${i + 1} de ${ok.length}: ${file.name}` : `Enviando ${file.name}`);
      try {
        const url = await uploadUrl();
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
        if (!res.ok) throw new Error(`Falha no envio (${res.status})`);
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        const isVideo = mediaKind(file) === "video";
        await add({ contentId, storageId, kind: isVideo ? "video" : "imagem" });
        // Vídeo sem capa: tira um quadro do arquivo local na hora (o servidor ignora se já houver capa).
        if (isVideo) {
          try {
            setProgress(`Gerando capa de ${file.name}`);
            const frame = await captureFrame(file);
            const coverId = await uploadToStorage(await uploadUrl(), frame);
            await setCover({ contentId, storageId: coverId as Id<"_storage">, source: "quadro" });
          } catch {
            // Sem capa automática: dá para subir uma à mão na seção Capa.
          }
        }
      } catch (err) {
        problems.push(err instanceof Error && !("data" in err) ? `${file.name}: ${err.message}` : errorText(err));
      }
    }
    setProgress(null);
    if (problems.length) setError(problems.join(" "));
    return ok.length;
  };

  return { upload, progress, error, setError };
}

/** Upload, ordem e remoção dos cards da versão atual. */
export function MediaManager({ contentId, media, version, compact = false }: { contentId: Id<"contents">; media: MediaItem[]; version: number; compact?: boolean }) {
  const add = useMutation(api.media.add);
  const remove = useMutation(api.media.remove);
  const move = useMutation(api.media.move);
  const input = useRef<HTMLInputElement>(null);
  const { upload: send, progress, error, setError } = useMediaUpload();
  const [link, setLink] = useState("");
  const [dragging, setDragging] = useState(false);

  const upload = async (files: FileList | File[]) => {
    await send(contentId, files);
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
        <h2 className={compact ? "text-base font-bold" : "text-xl font-extrabold tracking-[-0.04em]"}>{compact ? "Fotos e vídeos" : `Mídia da versão ${version}`}</h2>
        <span className="text-sm text-texto-2">{media.length} {media.length === 1 ? "card" : "cards"}</span>
      </div>

      {media.length > 0 && (
        <ol className={`grid gap-3 ${compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-4"}`}>
          {media.map((m, i) => (
            <li key={m._id} className="flex flex-col gap-1.5">
              <span className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-thumb">
                {m.kind === "imagem" && m.url && <img src={m.url} alt="" className="size-full object-cover" />}
                {m.kind === "video" && m.url && <video src={m.url} muted playsInline preload="metadata" className="size-full object-cover" />}
                {m.kind === "link" && (
                  <a
                    href={m.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    title={m.url ?? undefined}
                    className="flex size-full flex-col items-center justify-center gap-1.5 bg-white p-2 text-center hover:bg-[#FFF6FA]"
                  >
                    <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-rosa-forte stroke-2" aria-hidden="true">
                      <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
                    </svg>
                    <span className="max-w-full truncate text-[11px] font-semibold text-texto-3">{m.url ? linkHost(m.url) : "Link"}</span>
                    <span className="text-xs font-bold text-rosa-forte underline">Abrir link</span>
                  </a>
                )}
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
        className={`flex cursor-pointer flex-col items-center gap-1.5 border-[1.5px] border-dashed text-center transition-colors ${compact ? "p-4" : "p-6"} ${
          dragging ? "border-rosa-forte bg-white" : "border-campo"
        }`}
      >
        <strong className="text-[15px]">
          {progress ?? (media.length ? "Adicionar mais fotos ou vídeos" : "Escolha as fotos ou vídeos")}
        </strong>
        <span className="text-[13px] text-texto-2">
          Pode selecionar várias de uma vez (Ctrl ou Shift no computador, toque em várias no celular). Entram na ordem escolhida, até 100 MB cada.
        </span>
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
