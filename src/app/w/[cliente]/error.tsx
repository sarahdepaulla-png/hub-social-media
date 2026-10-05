"use client";

import Link from "next/link";
import { Asterisk, buttonClass } from "@/components/brand";

export default function WorkspaceError({ error, reset }: { error: Error; reset: () => void }) {
  const notFound = /não encontrado|não é seu|Sem acesso/i.test(error.message);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
      <Asterisk size={44} color="var(--color-rosa)" />
      <h1 className="titulo text-5xl">{notFound ? "Este workspace não está disponível" : "Algo travou aqui"}</h1>
      <p className="text-lg leading-relaxed text-texto-3">
        {notFound
          ? "O link pode estar errado ou ser de outro cliente. Volte para o seu início."
          : "Tente de novo. Se continuar, avise o estúdio."}
      </p>
      <div className="flex gap-3">
        <Link href="/" className={buttonClass.primary}>Ir para o início</Link>
        {!notFound && (
          <button type="button" onClick={reset} className={buttonClass.outline}>Tentar de novo</button>
        )}
      </div>
    </main>
  );
}
