"use client";

import { useState } from "react";
import { Asterisk, buttonClass } from "@/components/brand";

/**
 * Tela de erro do Hub. Mostra um caminho claro (tentar de novo ou entrar de novo)
 * e um detalhe técnico curto que a cliente pode mandar print para o estúdio.
 */
export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset?: () => void }) {
  const [copied, setCopied] = useState(false);
  const data = (error as { data?: unknown } | undefined)?.data;
  const msg = typeof data === "string" ? data : (error?.message ?? "");
  const session = /Sem acesso|Unauthenticated|auth|token|JWT/i.test(msg);
  const notFound = /não encontrado|não é seu/i.test(msg);
  const detail = [msg.slice(0, 300), error?.digest ? `ref ${error.digest}` : null].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10 text-vinho">
      <Asterisk size={44} color="var(--color-rosa)" />
      <h1 className="titulo text-5xl">
        {session ? "Entre de novo" : notFound ? "Página não disponível" : "Algo travou aqui"}
      </h1>
      <p className="text-lg leading-relaxed text-texto-3">
        {session
          ? "Sua sessão venceu. Toque de novo no seu link de acesso ou entre com o seu e-mail."
          : notFound
            ? "O link pode estar errado ou ser de outro cliente. Volte para o seu início."
            : "Tente de novo. Se continuar, mande um print desta tela para o estúdio."}
      </p>
      <div className="flex flex-wrap gap-3">
        {reset && !session && !notFound && (
          <button type="button" onClick={() => { reset(); window.location.reload(); }} className={buttonClass.primary}>
            Tentar de novo
          </button>
        )}
        <a href={session ? "/entrar" : "/"} className={session || notFound ? buttonClass.primary : buttonClass.outline}>
          {session ? "Entrar" : "Ir para o início"}
        </a>
      </div>
      {detail && (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(detail).then(() => setCopied(true))}
          className="self-start rounded-lg bg-white px-3 py-2 text-left font-mono text-[11px] leading-snug text-texto-2"
        >
          {copied ? "Detalhe copiado" : detail}
        </button>
      )}
    </main>
  );
}
