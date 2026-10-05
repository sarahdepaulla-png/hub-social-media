"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useEffect, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Sticker, buttonClass } from "@/components/brand";

type Choice = "aprovar" | "aprovar_obs" | "ajuste";

const OPTIONS: { value: Choice; label: string; hint: string; color: string }[] = [
  { value: "aprovar", label: "Aprovar", hint: "Pode seguir para agendamento", color: "var(--color-rosa-forte)" },
  { value: "aprovar_obs", label: "Aprovar com observação", hint: "Segue, com um detalhe para o estúdio", color: "var(--color-rosa-forte)" },
  { value: "ajuste", label: "Solicitar ajuste", hint: "Volta para produção", color: "var(--color-st-ajuste)" },
];

export function errorText(err: unknown) {
  if (err instanceof ConvexError) return String(err.data);
  return "Não deu certo. Confira a conexão e tente de novo.";
}

/**
 * Sheet de decisão (sobe da base no celular, centraliza no desktop).
 * Usa <dialog> nativo: foco preso, Esc fecha, leitor de tela entende.
 */
export function DecisionSheet({
  open,
  initial,
  onClose,
  contentId,
  title,
  captionLabel,
  cardIndex,
  cardCount,
  nextHref,
  remaining,
  onDecided,
}: {
  open: boolean;
  initial: Choice;
  onClose: () => void;
  contentId: Id<"contents">;
  title: string;
  captionLabel: string | null;
  cardIndex: number;
  cardCount: number;
  nextHref: string | null;
  remaining: number;
  onDecided: (d: { decisionId: Id<"decisions">; type: Choice }) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [choice, setChoice] = useState<Choice>(initial);
  const [comment, setComment] = useState("");
  const [aboutCard, setAboutCard] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ decisionId: Id<"decisions">; type: Choice } | null>(null);
  const decide = useMutation(api.contents.decide);
  const undo = useMutation(api.contents.undoDecision);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setChoice(initial);
      setError(null);
      setDone(null);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, initial]);

  // Escrever uma observação no "Aprovar" vira "Aprovar com observação".
  const effective: Choice = choice === "aprovar" && comment.trim() ? "aprovar_obs" : choice;
  const needsText = effective !== "aprovar";

  const submit = async () => {
    if (needsText && !comment.trim()) {
      setError(choice === "ajuste" ? "Conte o que precisa mudar." : "Escreva a sua observação.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { decisionId } = await decide({
        contentId,
        type: effective,
        comment: comment.trim() || undefined,
        mediaOrder: aboutCard ? cardIndex + 1 : undefined,
      });
      const d = { decisionId, type: effective };
      setDone(d);
      setComment("");
      onDecided(d);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  };

  const doUndo = async () => {
    if (!done) return;
    try {
      await undo({ decisionId: done.decisionId });
      setDone(null);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="decisao-titulo"
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-vinho-escuro/45 md:m-auto md:max-w-lg"
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="flex flex-col gap-4 rounded-t-3xl bg-white px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 shadow-flutua md:rounded-3xl md:pt-6">
        <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-campo md:hidden" />

        {done ? (
          <div role="status" className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="relative mt-3 h-[150px] w-[120px]">
              <span className="absolute inset-0 rounded-peca bg-thumb" />
              {done.type === "ajuste" ? (
                <span className="absolute -inset-2 border-2 border-st-ajuste">
                  {["-left-1.5 -top-1.5", "-right-1.5 -top-1.5", "-bottom-1.5 -left-1.5", "-bottom-1.5 -right-1.5"].map((p) => (
                    <span key={p} className={`absolute size-2.5 bg-st-ajuste ${p}`} />
                  ))}
                </span>
              ) : (
                <Sticker size={92} animate className="absolute -right-9 -top-7" />
              )}
            </div>
            <h2 id="decisao-titulo" className="titulo text-[32px]">
              {done.type === "ajuste" ? "Ajuste solicitado" : done.type === "aprovar_obs" ? "Aprovado com observação" : "Aprovado"}
            </h2>
            <p className="text-sm text-texto-2">
              {remaining > 0 ? `Faltam ${remaining} ${remaining === 1 ? "conteúdo" : "conteúdos"} esperando você.` : "Era o último que faltava. Tudo em dia."}
            </p>
            {nextHref ? (
              <Link href={nextHref} className={`${buttonClass.primary} self-stretch`} onClick={onClose}>
                Ver o próximo
              </Link>
            ) : (
              <button type="button" onClick={onClose} className={`${buttonClass.primary} self-stretch`}>
                Fechar
              </button>
            )}
            <button type="button" onClick={doUndo} className="min-h-11 text-[15px] font-semibold text-rosa-forte">
              Desfazer
            </button>
            {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h2 id="decisao-titulo" className="titulo text-[32px]">Sua decisão</h2>
              <span className="text-sm text-texto-2">
                {title}
                {captionLabel ? `, ${captionLabel}` : ""}
              </span>
            </div>

            <div role="radiogroup" aria-label="Decisão" className="flex flex-col gap-2">
              {OPTIONS.map((o) => {
                const on = choice === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setChoice(o.value)}
                    className="flex min-h-[60px] items-center gap-3.5 rounded-peca border-2 bg-white px-3.5 py-2.5 text-left"
                    style={{ borderColor: on ? o.color : "var(--color-linha)" }}
                  >
                    <span
                      aria-hidden="true"
                      className="size-5 shrink-0 rounded-full"
                      style={{ border: on ? `6px solid ${o.color}` : "2px solid var(--color-st-ideia)" }}
                    />
                    <span className="flex flex-col gap-0.5">
                      <strong className="text-base">{o.label}</strong>
                      <span className="text-[13px] text-texto-2">{o.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              {choice === "ajuste" ? "O que precisa mudar? (obrigatório)" : choice === "aprovar_obs" ? "Sua observação" : "Comentário (opcional)"}
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={choice === "ajuste" ? "Ex.: no card 3, trocar a foto pela de perfil" : "Escreva aqui"}
                className="resize-none border-[1.5px] border-campo p-3 text-base font-normal"
              />
            </label>
            {cardCount > 1 && comment.trim() && (
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" checked={aboutCard} onChange={(e) => setAboutCard(e.target.checked)} className="size-[18px] accent-rosa-forte" />
                Sobre o card {cardIndex + 1}
              </label>
            )}
            {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className={effective === "ajuste" ? `${buttonClass.primary} bg-st-ajuste-texto hover:bg-st-ajuste-texto` : buttonClass.primary}
            >
              {pending ? "Registrando" : OPTIONS.find((o) => o.value === effective)!.label}
            </button>
            <span className="text-center text-xs text-texto-2">Fica registrado com seu nome, data e hora.</span>
          </>
        )}
      </div>
    </dialog>
  );
}
