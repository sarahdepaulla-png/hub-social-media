/**
 * Prévia de links de referência: descobre a plataforma, a imagem e o título.
 * Funções puras, sem rede, para dar para testar.
 */

export type Platform = "instagram" | "tiktok" | "youtube" | "pinterest" | "site";

export function platformOf(url: string): Platform {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "site";
  }
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.endsWith("tiktok.com")) return "tiktok";
  if (host.endsWith("youtube.com") || host === "youtu.be") return "youtube";
  if (host.includes("pinterest.") || host === "pin.it") return "pinterest";
  return "site";
}

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]{6,})/);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    // property="og:image" content="..."  ou  content="..." property="og:image"
    const a = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, "i").exec(html);
    if (a) return decodeEntities(a[1]);
    const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`, "i").exec(html);
    if (b) return decodeEntities(b[1]);
  }
  return null;
}

/** Lê og:image e título de um HTML. Resolve caminhos relativos. */
export function parsePreview(html: string, pageUrl: string): { image: string | null; title: string | null } {
  let image = metaContent(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]);
  if (image) {
    try {
      image = new URL(image, pageUrl).toString();
    } catch {
      image = null;
    }
  }
  let title = metaContent(html, ["og:title", "twitter:title"]);
  if (!title) {
    const t = /<title[^>]*>([^<]{1,300})<\/title>/i.exec(html);
    title = t ? decodeEntities(t[1]) : null;
  }
  // Páginas de login não servem de prévia.
  if (title && /^(login|entrar|instagram|tiktok - make your day)$/i.test(title.trim())) title = null;
  return { image, title: title ? title.slice(0, 140) : null };
}

/** Nome curto do site, para cartões sem imagem. */
export function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}
