"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useRef, useState } from "react";
import { Asterisk, Logo, buttonClass } from "@/components/brand";

/** Entrada pelo link do WhatsApp: valida o token e manda para o workspace. */
export default function AcessoPage() {
  const { token } = useParams<{ token: string }>();
  const { signIn } = useAuthActions();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    signIn("link", { token })
      // Recarrega a página inteira para o servidor já enxergar a sessão nova.
      .then(() => window.location.replace("/"))
      .catch(() => setFailed(true));
  }, [signIn, token]);

  return (
    <main className="flex min-h-dvh flex-col">
      <section className="grade-rosa px-6 pb-12 pt-8">
        <div className="mx-auto flex max-w-md flex-col gap-10">
          <Logo className="text-[19px] text-white" />
          <h1 className="titulo flex items-center gap-3 text-[56px] text-white">
            {failed ? "Link inválido" : "Entrando"}
            <Asterisk size={42} color="var(--color-vinho)" spinning={!failed} />
          </h1>
        </div>
      </section>
      <section className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-10">
        {failed ? (
          <>
            <p className="text-lg leading-relaxed text-texto-3">
              Este link não funciona mais. Ele pode ter sido trocado pelo estúdio. Peça um link novo pelo WhatsApp.
            </p>
            <Link href="/entrar" className={buttonClass.outline}>
              Entrar com e-mail
            </Link>
          </>
        ) : (
          <p role="status" className="text-lg text-texto-3">
            Conferindo seu acesso. Na próxima vez você já entra direto.
          </p>
        )}
      </section>
    </main>
  );
}
