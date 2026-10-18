import { Fragment } from "react";

const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]}'"])/gi;

/** Texto com os links clicáveis: abrem em outra aba, direto no endereço que a pessoa colou. */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const href = part.startsWith("www.") ? `https://${part}` : part;
        return (
          <a key={i} href={href} target="_blank" rel="noreferrer" className="break-all font-semibold text-rosa-forte underline underline-offset-2 hover:text-rosa-forte-hover">
            {part}
          </a>
        );
      })}
    </>
  );
}

/** Nome curto do site do link (drive.google.com, canva.com...). */
export function linkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}
