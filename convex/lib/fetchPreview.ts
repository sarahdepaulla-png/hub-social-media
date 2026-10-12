import { parsePreview, platformOf, youtubeId } from "./preview";

/**
 * Busca a imagem de prévia de um link (usado em Ideias e no Feed).
 * Usa o mesmo robô de prévia do Facebook: o Instagram libera a capa para ele.
 * Só roda dentro de actions (precisa de rede).
 */

export const PREVIEW_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const UA = PREVIEW_UA;
export const MAX_PREVIEW_IMAGE = 8 * 1024 * 1024;

async function fetchText(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/json", "Accept-Language": "pt-BR,pt;q=0.9" },
    redirect: "follow",
  });
  if (!res.ok) return null;
  return (await res.text()).slice(0, 800_000);
}

export async function findPreview(link: string): Promise<{ image: string | null; title: string | null }> {
  const platform = platformOf(link);

  if (platform === "youtube") {
    const id = youtubeId(link);
    let title: string | null = null;
    try {
      const o = await fetchText(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link)}`);
      if (o) title = (JSON.parse(o) as { title?: string }).title ?? null;
    } catch {
      /* sem título */
    }
    return { image: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null, title };
  }

  if (platform === "tiktok") {
    try {
      const o = await fetchText(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link)}`);
      if (o) {
        const j = JSON.parse(o) as { thumbnail_url?: string; title?: string };
        if (j.thumbnail_url) return { image: j.thumbnail_url, title: j.title ?? null };
      }
    } catch {
      /* tenta a página */
    }
  }

  const html = await fetchText(link);
  return html ? parsePreview(html, link) : { image: null, title: null };
}


/** Baixa a imagem da prévia. Devolve o arquivo ou null. */
export async function downloadImage(image: string): Promise<Blob | null> {
  const res = await fetch(image, { headers: { "User-Agent": UA } }).catch(() => null);
  const type = res?.headers.get("content-type") ?? "";
  if (!res?.ok || !type.startsWith("image/")) return null;
  const blob = await res.blob();
  return blob.size > 0 && blob.size <= MAX_PREVIEW_IMAGE ? blob : null;
}
