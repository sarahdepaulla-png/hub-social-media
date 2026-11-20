"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";

type Answer = "continuar" | "pensar";

const SESSION_KEY = "hub-recado-aberto";

/** Lê/grava na sessão sem quebrar quando o navegador bloqueia. */
function sessionFlag(set?: boolean) {
  try {
    if (set) sessionStorage.setItem(SESSION_KEY, "1");
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function Bubble({ children, me = false }: { children: ReactNode; me?: boolean }) {
  return (
    <div className={`flex ${me ? "justify-end" : "justify-start"} animate-[recado-in_.25s_ease-out]`}>
      <div
        className={`max-w-[86%] px-4 py-2.5 text-[15px] leading-relaxed ${
          me ? "rounded-[20px] rounded-br-md bg-vinho text-white" : "rounded-[20px] rounded-tl-md bg-white text-vinho"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex justify-start" aria-hidden="true">
      <div className="flex gap-1 rounded-[20px] rounded-tl-md bg-white px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 animate-bounce rounded-full bg-rosa-forte" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden="true" className="mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-[5px] border-2 border-vinho text-[13px] font-black">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

/**
 * Recado do estúdio dentro do Hub, em formato de conversa: abre no canto com a foto
 * da Sarah, as mensagens chegam uma a uma e a cliente responde tocando num botão.
 */
export function NoticeChat({ slug }: { slug: string }) {
  const data = useQuery(api.notices.mine, { slug });
  const seen = useMutation(api.notices.seen);
  const reply = useMutation(api.notices.answer);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(0);
  const [local, setLocal] = useState<Answer | null>(null);
  const [after, setAfter] = useState(0);
  const end = useRef<HTMLDivElement>(null);

  const answer = local ?? data?.answer ?? null;
  const you = data?.plural ? "vocês" : "você";
  const youObj = data?.plural ? "vocês" : "você";

  const script: ReactNode[] = data
    ? [
        <>Oiê, {data.firstName}! Tudo bem?</>,
        <>
          Passando para avisar que vou entrar em recesso a partir de <b>12 de dezembro</b> e volto no dia <b>11 de janeiro</b>.
        </>,
        <img key="gif" src="/recado/recesso.gif" alt="Recesso de fim de ano: pausa a partir de 12 de dezembro, volta em 11 de janeiro" className="-mx-2 -my-1 block w-[calc(100%+16px)] max-w-none rounded-xl" />,
        <>
          Se {you} {data.plural ? "quiserem" : "quiser"} seguir comigo no ano que vem, a ideia é planejar e produzir dezembro e janeiro antes da minha pausa. Assim o perfil continua ativo durante as festas e a gente começa 2027 sem correria.
        </>,
        <>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[1.5px] text-rosa-forte">Como fica</p>
          <ul className="flex flex-col gap-2">
            <Check>
              {data.plural ? "Vocês me confirmam" : "Você me confirma"} <b>até 28/11</b> se {data.plural ? "querem" : "quer"} continuar
            </Check>
            <Check>Eu monto o calendário dos dois meses e mando aqui no Hub para {youObj} aprovar{data.plural ? "em" : ""}</Check>
            <Check>
              Tudo aprovado e agendado <b>antes de 12/12</b>
            </Check>
          </ul>
        </>,
        <>Me responde por aqui mesmo 👇</>,
      ]
    : [];

  const thanks: ReactNode[] =
    answer === "continuar"
      ? [<>Oba! Fico muito feliz 🥹</>, <>Já vou montar dezembro e janeiro e aviso aqui quando estiver pronto para aprovar.</>, <>Obrigada por confiar no meu trabalho este ano. Boas festas para {you} e para quem {you} {data?.plural ? "amam" : "ama"}! ✨</>]
      : answer === "pensar"
        ? [<>Tranquilo! Só me fala até 28/11, combinado?</>, <>Obrigada por confiar no meu trabalho este ano. Boas festas para {you} e para quem {you} {data?.plural ? "amam" : "ama"}! ✨</>]
        : [];

  // Abre sozinho: na primeira vez, e de novo em cada visita enquanto não houver resposta.
  useEffect(() => {
    if (!data || data.answer) return;
    if (data.seenAt && sessionFlag()) return;
    const t = setTimeout(() => {
      setOpen(true);
      sessionFlag(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [data]);

  // Mensagens chegando uma a uma (já respondido ou movimento reduzido: tudo de uma vez).
  const instant = !!data?.answer || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (!open || !data) return;
    if (instant) return;
    if (shown >= script.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 500 : 1100);
    return () => clearTimeout(t);
  }, [open, data, shown, script.length, instant]);
  useEffect(() => {
    if (!open || !local) return;
    if (after >= thanks.length) return;
    const t = setTimeout(() => setAfter((n) => n + 1), 900);
    return () => clearTimeout(t);
  }, [open, local, after, thanks.length]);

  useEffect(() => {
    if (open && data && !data.seenAt && !data.preview) void seen({ slug }).catch(() => undefined);
  }, [open, data, seen, slug]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [shown, after, open, local]);

  if (!data) return null;
  const visible = instant ? script.length : shown;
  const done = visible >= script.length;
  const afterVisible = local ? after : thanks.length;

  const send = (a: Answer) => {
    setLocal(a);
    setAfter(0);
    if (!data.preview) void reply({ slug, answer: a }).catch(() => undefined);
  };

  return (
    <>
      <style>{`@keyframes recado-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
      {!open && answer !== "continuar" && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir recado da Sarah"
          className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-4 z-40 size-16 rounded-full border-[3px] border-white bg-rosa shadow-[0_8px_24px_rgba(92,15,49,.25)] md:bottom-6 md:right-6"
        >
          {data.photoUrl ? <img src={data.photoUrl} alt="" className="size-full rounded-full object-cover" /> : <span className="text-2xl font-black text-vinho">S</span>}
          {!answer && <span className="absolute -right-0.5 -top-0.5 flex size-6 items-center justify-center rounded-full bg-rosa-forte text-xs font-bold text-white">1</span>}
        </button>
      )}
      {open && (
        <section
          role="dialog"
          aria-label="Recado da Sarah"
          className="fixed inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-50 flex max-h-[min(640px,calc(100dvh-120px))] flex-col overflow-hidden rounded-[24px] border-2 border-vinho bg-creme shadow-[0_18px_48px_rgba(92,15,49,.28)] md:inset-x-auto md:bottom-6 md:right-6 md:w-[390px]"
        >
          <header className="flex items-center gap-3 bg-vinho px-4 py-3 text-white">
            <span className="relative size-11 shrink-0">
              {data.photoUrl ? <img src={data.photoUrl} alt="" className="size-full rounded-full border-2 border-rosa object-cover" /> : <span className="flex size-full items-center justify-center rounded-full bg-rosa font-black text-vinho">S</span>}
              <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-vinho bg-[#3DDC84]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <strong className="text-[17px] leading-tight">Sarah</strong>
              <span className="text-xs font-semibold uppercase tracking-[1.5px] text-rosa">Hub Social Media*</span>
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="flex size-10 items-center justify-center rounded-full hover:bg-white/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4" aria-live="polite">
            {data.preview && <p className="mb-1 rounded-xl bg-white/70 px-3 py-2 text-center text-xs text-texto-3">Prévia: é assim que a cliente vê. Tocar nos botões aqui não conta como resposta.</p>}
            {script.slice(0, visible).map((m, i) => (
              <Bubble key={i}>{m}</Bubble>
            ))}
            {!done && open && <Typing />}
            {answer && done && (
              <Bubble me>{answer === "continuar" ? "Quero continuar em 2027! 🙌" : "Vou pensar e te falo"}</Bubble>
            )}
            {answer && done && thanks.slice(0, afterVisible).map((m, i) => <Bubble key={`t${i}`}>{m}</Bubble>)}
            {local && afterVisible < thanks.length && <Typing />}
            <div ref={end} />
          </div>

          {done && (
            <footer className="flex flex-col gap-2 border-t-2 border-vinho/10 bg-creme px-3 pb-3 pt-3">
              {!answer ? (
                <>
                  <button
                    type="button"
                    onClick={() => send("continuar")}
                    className="min-h-12 rounded-full border-2 border-vinho bg-rosa px-5 text-base font-extrabold tracking-tight text-vinho shadow-[0_4px_0_#5c0f31] transition-transform active:translate-y-1 active:shadow-none"
                  >
                    Quero continuar em 2027 →
                  </button>
                  <button type="button" onClick={() => send("pensar")} className="min-h-11 rounded-full px-4 text-sm font-semibold text-vinho hover:bg-white">
                    Vou pensar e te falo
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-texto-2">{answer === "continuar" ? "Resposta enviada para a Sarah." : "Pode mudar de ideia quando quiser."}</span>
                  {answer === "pensar" && (
                    <button type="button" onClick={() => send("continuar")} className="min-h-10 rounded-full bg-rosa px-4 text-sm font-bold text-vinho">
                      Quero continuar
                    </button>
                  )}
                </div>
              )}
            </footer>
          )}
        </section>
      )}
    </>
  );
}
