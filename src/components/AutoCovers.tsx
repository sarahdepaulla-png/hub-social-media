"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { captureFrame, uploadToStorage } from "@/lib/videoFrame";

/**
 * Invisível. Na tela da admin, gera a capa das peças que só têm vídeo,
 * tirando um quadro do próprio vídeo. Cada peça é tentada uma vez por visita.
 */
export function AutoCovers({ contentId }: { contentId?: Id<"contents"> }) {
  const missing = useQuery(api.media.missingCovers, contentId ? { contentId } : {});
  const uploadUrl = useMutation(api.media.generateUploadUrl);
  const setCover = useMutation(api.media.setCover);
  const tried = useRef(new Set<string>());
  const busy = useRef(false);

  useEffect(() => {
    if (!missing?.length || busy.current) return;
    const next = missing.find((m) => !tried.current.has(m.contentId));
    if (!next) return;
    busy.current = true;
    tried.current.add(next.contentId);
    (async () => {
      try {
        const frame = await captureFrame(next.videoUrl);
        const storageId = await uploadToStorage(await uploadUrl(), frame);
        await setCover({ contentId: next.contentId, storageId: storageId as Id<"_storage">, source: "quadro" });
      } catch (err) {
        console.warn("[hub] capa automática não gerada", next.contentId, err);
      } finally {
        busy.current = false;
      }
    })();
  }, [missing, uploadUrl, setCover]);

  return null;
}
