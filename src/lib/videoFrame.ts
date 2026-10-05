/**
 * Tira um quadro de um vídeo e devolve como JPG.
 * Aceita um arquivo local (no upload) ou a URL de um vídeo já salvo.
 */
export async function captureFrame(source: File | string, atSeconds = 1): Promise<Blob> {
  const objectUrl = typeof source === "string" ? null : URL.createObjectURL(source);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  if (typeof source === "string") video.crossOrigin = "anonymous";
  video.src = objectUrl ?? (source as string);

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("O vídeo demorou para carregar")), 20000);
      video.onloadedmetadata = () => {
        // Evita quadro preto do começo; em vídeos curtos, pega o meio.
        video.currentTime = Math.min(atSeconds, (video.duration || 2) / 2);
      };
      video.onseeked = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Não deu para ler o vídeo"));
      };
    });

    const maxW = 1080;
    const scale = Math.min(1, maxW / (video.videoWidth || maxW));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((video.videoWidth || maxW) * scale);
    canvas.height = Math.round((video.videoHeight || maxW) * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a capa"))), "image/jpeg", 0.82),
    );
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    video.removeAttribute("src");
    video.load();
  }
}

/** Sobe um arquivo para o storage do Convex e devolve o id. */
export async function uploadToStorage(uploadUrl: string, blob: Blob): Promise<string> {
  const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": blob.type || "image/jpeg" }, body: blob });
  if (!res.ok) throw new Error(`Falha no envio (${res.status})`);
  return ((await res.json()) as { storageId: string }).storageId;
}
