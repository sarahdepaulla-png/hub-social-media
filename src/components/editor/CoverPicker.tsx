"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Thumb } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { uploadToStorage } from "@/lib/videoFrame";

const SOURCE_TEXT = {
  imagem: "Automática: primeira imagem do carrossel",
  quadro: "Automática: quadro tirado do vídeo",
  manual: "Capa enviada por você",
} as const;

/** Capa que aparece no calendário, no Início da cliente e no Estúdio. */
export function CoverPicker({
  contentId,
  coverUrl,
  coverSource,
}: {
  contentId: Id<"contents">;
  coverUrl: string | null;
  coverSource: "imagem" | "quadro" | "manual" | null;
}) {
  const uploadUrl = useMutation(api.media.generateUploadUrl);
  const setCover = useMutation(api.media.setCover);
  const resetCover = useMutation(api.media.resetCover);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section aria-label="Capa" className="flex flex-col gap-3">
      <h2 className="text-xl font-extrabold tracking-[-0.04em]">Capa</h2>
      <div className="flex items-start gap-4">
        <Thumb url={coverUrl} label={coverUrl ? undefined : "Sem capa"} className="aspect-[4/5] w-28 shrink-0" />
        <div className="flex flex-col gap-2 text-sm">
          <span className="text-texto-2">
            {coverSource ? SOURCE_TEXT[coverSource] : "A capa aparece sozinha quando você sobe uma imagem ou um vídeo."}
          </span>
          <label className="inline-flex min-h-10 cursor-pointer items-center self-start rounded-full border-[1.5px] border-vinho px-4 font-semibold">
            {busy ? "Enviando" : coverSource === "manual" ? "Trocar capa" : "Enviar capa própria"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                setError(null);
                try {
                  const storageId = await uploadToStorage(await uploadUrl(), file);
                  await setCover({ contentId, storageId: storageId as Id<"_storage">, source: "manual" });
                } catch (err) {
                  setError(errorText(err));
                } finally {
                  setBusy(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
          {coverSource === "manual" && (
            <button type="button" onClick={() => resetCover({ contentId })} className="min-h-9 self-start text-sm font-semibold text-rosa-forte">
              Voltar para a capa automática
            </button>
          )}
          {error && <p role="alert" className="font-semibold text-st-ajuste-texto">{error}</p>}
        </div>
      </div>
    </section>
  );
}
