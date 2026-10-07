import { redirect } from "next/navigation";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { Asterisk, Logo } from "@/components/brand";
import { SignOutButton } from "@/components/SignOutButton";

/** Porta de entrada: manda cada pessoa para o lugar certo. */
export default async function Home() {
  // Sessão vencida ou cookie antigo (comum no navegador do WhatsApp): manda entrar de novo
  // em vez de quebrar a página.
  let me: Awaited<ReturnType<typeof fetchQuery<typeof api.viewer.me>>> = null;
  try {
    me = await fetchQuery(api.viewer.me, {}, { token: await convexAuthNextjsToken() });
  } catch {
    // Sem redirecionar para /entrar (o cookie antigo faria voltar para cá em loop):
    // mostra a saída e limpa a sessão.
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
        <Logo />
        <Asterisk size={48} color="var(--color-rosa)" />
        <h1 className="titulo text-5xl">Entre de novo</h1>
        <p className="text-lg leading-relaxed text-texto-3">
          Sua sessão venceu. Toque em sair e depois abra de novo o seu link de acesso, ou entre com o seu e-mail.
        </p>
        <SignOutButton />
      </main>
    );
  }
  if (!me) redirect("/entrar");
  if (me.role === "admin") redirect("/estudio");
  if (me.client) redirect(`/w/${me.client.slug}`);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
      <Logo />
      <Asterisk size={48} color="var(--color-rosa)" />
      <h1 className="titulo text-5xl">Seu acesso ainda não está pronto</h1>
      <p className="text-lg leading-relaxed text-texto-3">
        Entramos com {me.email}, mas este e-mail ainda não está ligado a um workspace. Fale com o estúdio para liberar.
      </p>
      <SignOutButton />
    </main>
  );
}
