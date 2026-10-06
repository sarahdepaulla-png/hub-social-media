"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Asterisk, Logo, SelectionBox, buttonClass } from "@/components/brand";

function message(err: unknown, step: "email" | "code") {
  const text = err instanceof Error ? err.message : String(err);
  if (/acesso/i.test(text)) return "Este e-mail ainda não tem acesso. Confira se digitou o mesmo e-mail que passou para o estúdio.";
  if (step === "code") return "Código incorreto ou vencido. Confira os 6 números ou peça um novo.";
  return "Não conseguimos enviar o código. Confira o e-mail e tente de novo.";
}

function LoginForm() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const back = useSearchParams().get("volta");
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const data = new FormData(e.currentTarget);
      data.set("email", String(data.get("email")).trim().toLowerCase());
      await signIn("email-otp", data);
      setEmail(String(data.get("email")));
      setStep("code");
    } catch (err) {
      setError(message(err, "email"));
    } finally {
      setPending(false);
    }
  };

  const verify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signIn("email-otp", new FormData(e.currentTarget));
      router.replace(back && back.startsWith("/") ? back : "/");
    } catch (err) {
      setError(message(err, "code"));
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <section className="grade-rosa px-6 pb-12 pt-8">
        <div className="mx-auto flex max-w-md flex-col gap-10">
          <Logo className="text-[19px] text-white" />
          <h1 className="titulo flex items-center gap-3 text-[64px] text-white">
            Entrar <Asterisk size={46} color="var(--color-vinho)" />
          </h1>
          <SelectionBox className="self-start px-4 py-2.5 text-[17px] leading-snug">
            Entre pelo <strong>link que o estúdio te mandou no WhatsApp.</strong>
          </SelectionBox>
        </div>
      </section>

      <section className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        {step === "email" ? (
          <form onSubmit={sendCode} className="flex flex-col gap-5">
            <p className="text-[17px] leading-relaxed text-texto-3">
              Sem o link? Digite o seu e-mail e receba um código de 6 números para entrar.
            </p>
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Seu e-mail
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="voce@email.com"
                defaultValue={email}
                className="min-h-13 rounded-none border-[1.5px] border-campo bg-white px-4 text-lg font-normal"
              />
            </label>
            {error && <p role="alert" className="text-[15px] font-semibold text-st-ajuste-texto">{error}</p>}
            <button type="submit" disabled={pending} className={buttonClass.primary}>
              {pending ? "Enviando código" : "Receber código"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="flex flex-col gap-5">
            <p className="text-[17px] leading-relaxed text-texto-3">
              Enviamos 6 números para <strong className="text-vinho">{email}</strong>. Pode demorar um minutinho.
            </p>
            <input type="hidden" name="email" value={email} />
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Código
              <input
                name="code"
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                className="min-h-16 border-[1.5px] border-campo bg-white px-4 text-center text-3xl font-extrabold tracking-[0.4em]"
              />
            </label>
            {error && <p role="alert" className="text-[15px] font-semibold text-st-ajuste-texto">{error}</p>}
            <button type="submit" disabled={pending} className={buttonClass.primary}>
              {pending ? "Entrando" : "Entrar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
              }}
              className="min-h-11 text-[15px] font-semibold text-rosa-forte"
            >
              Usar outro e-mail ou pedir novo código
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export default function EntrarPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
