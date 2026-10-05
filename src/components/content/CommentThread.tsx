"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { stamp } from "@/lib/dates";
import { errorText } from "./DecisionSheet";

type Comment = {
  _id: string;
  parentId: string | null;
  body: string;
  at: number;
  mediaOrder: number | null;
  decisionLabel: string | null;
  author: { name: string; role: string };
  isMine: boolean;
};

function Bubble({ c, accent }: { c: Comment; accent: string }) {
  const studio = c.author.role === "admin";
  return (
    <div className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ background: studio ? "var(--color-vinho)" : accent }}
      >
        {c.author.name.charAt(0).toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[13px] text-texto-2">
          <strong className="text-vinho">{studio ? `${c.author.name}, estúdio` : c.author.name}</strong> {stamp(c.at)}
        </span>
        {(c.decisionLabel || c.mediaOrder) && (
          <span className="flex flex-wrap gap-1.5">
            {c.decisionLabel && (
              <span className="rounded-full bg-rosa px-2.5 py-0.5 text-xs font-bold text-vinho">{c.decisionLabel}</span>
            )}
            {c.mediaOrder && <span className="rounded-full border border-campo px-2.5 py-0.5 text-xs font-semibold">Card {c.mediaOrder}</span>}
          </span>
        )}
        <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{c.body}</p>
      </div>
    </div>
  );
}

function Composer({
  contentId,
  parentId,
  placeholder,
  onDone,
  autoFocus,
}: {
  contentId: Id<"contents">;
  parentId?: Id<"comments">;
  placeholder: string;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const add = useMutation(api.comments.add);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    try {
      await add({ contentId, body, parentId });
      setBody("");
      onDone?.();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="sr-only" htmlFor={`c-${parentId ?? "novo"}`}>
        {placeholder}
      </label>
      <textarea
        id={`c-${parentId ?? "novo"}`}
        rows={2}
        autoFocus={autoFocus}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        className="resize-y border-[1.5px] border-campo bg-white p-3 text-base"
      />
      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
      <button
        type="submit"
        disabled={pending || !body.trim()}
        className="min-h-10 self-end rounded-full bg-vinho px-5 text-sm font-semibold text-white disabled:opacity-40"
      >
        {pending ? "Enviando" : "Enviar"}
      </button>
    </form>
  );
}

/** Conversa da peça. Respostas ficam recuadas abaixo do comentário original. */
export function CommentThread({ contentId, comments, accent }: { contentId: Id<"contents">; comments: Comment[]; accent: string }) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const roots = comments.filter((c) => !c.parentId).sort((a, b) => a.at - b.at);
  const replies = (id: string) => comments.filter((c) => c.parentId === id).sort((a, b) => a.at - b.at);

  return (
    <div className="flex flex-col gap-6">
      {roots.length === 0 ? (
        <p className="text-base text-texto-2">Nenhum comentário ainda. Dúvida ou sugestão? Escreva aqui embaixo.</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {roots.map((c) => (
            <li key={c._id} className="flex flex-col gap-3">
              <Bubble c={c} accent={accent} />
              {replies(c._id).map((r) => (
                <div key={r._id} className="pl-12">
                  <Bubble c={r} accent={accent} />
                </div>
              ))}
              <div className="pl-12">
                {replyTo === c._id ? (
                  <Composer
                    contentId={contentId}
                    parentId={c._id as Id<"comments">}
                    placeholder="Sua resposta"
                    autoFocus
                    onDone={() => setReplyTo(null)}
                  />
                ) : (
                  <button type="button" onClick={() => setReplyTo(c._id)} className="min-h-9 text-sm font-semibold text-rosa-forte">
                    Responder
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Composer contentId={contentId} placeholder="Escreva um comentário" />
    </div>
  );
}

/** Histórico: tudo que aconteceu com a peça, do mais recente ao mais antigo. */
export function HistoryList({ contentId }: { contentId: Id<"contents"> }) {
  const items = useQuery(api.contents.history, { contentId });
  if (items === undefined) return <p className="text-sm text-texto-2">Carregando histórico</p>;
  if (items.length === 0) return <p className="text-base text-texto-2">Nada registrado ainda.</p>;
  return (
    <ol className="flex flex-col">
      {items.map((a) => (
        <li key={a._id} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-t border-linha py-3 text-sm last:border-b">
          <span className="text-texto-2">{stamp(a.at)}</span>
          <span>
            <strong>{a.userName}</strong> {a.summary.charAt(0).toLowerCase() + a.summary.slice(1)}
          </span>
        </li>
      ))}
    </ol>
  );
}
