"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Loading, buttonClass } from "@/components/brand";
import { StatusMenu } from "@/components/StatusMenu";
import { DueBadge, OwnerBadge, TaskFields } from "@/components/Task";
import { TrashButton } from "@/components/Trash";
import { CaptionPicker } from "@/components/content/CaptionPicker";
import { errorText } from "@/components/content/DecisionSheet";
import { CommentThread, HistoryList } from "@/components/content/CommentThread";
import { longDate, stamp } from "@/lib/dates";
import { FORMAT, PLATFORM } from "@/lib/labels";

type Tab = "briefing" | "legenda" | "ajustes" | "historico";

/** Com quem está e prazo: mostra os selos e abre a edição num toque. */
function TaskEditor({ contentId, owner, dueDate, done }: { contentId: Id<"contents">; owner: string | null; dueDate: string | null; done: boolean }) {
  const team = useQuery(api.team.list, {});
  const setTask = useMutation(api.contents.setTask);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <OwnerBadge owner={owner} />
        <DueBadge due={dueDate} done={done} />
        <button type="button" onClick={() => setOpen(true)} className="min-h-9 text-[13px] font-semibold text-rosa-forte">
          {owner || dueDate ? "Mudar responsável ou prazo" : "Definir responsável e prazo"}
        </button>
      </div>
    );
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setError(null);
    try {
      await setTask({
        contentId,
        owner: String(d.get("owner") ?? "").trim() || undefined,
        dueDate: String(d.get("dueDate") ?? "").trim() || undefined,
      });
      setOpen(false);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <TaskFields team={team ?? []} owner={owner} dueDate={dueDate} id="ficha" />
      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className={`${buttonClass.primary} min-h-10 px-4 text-sm`}>Salvar</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-10 px-3 text-sm font-semibold text-texto-2">Cancelar</button>
      </div>
    </form>
  );
}

/**
 * Ficha da peça para o estúdio: briefing, legendas, ajustes e histórico num
 * painel lateral, sem sair da esteira. A cliente nunca vê esta ficha: na
 * aprovação ela recebe só a versão final.
 */
export function PieceDrawer({ contentId, slug, onClose }: { contentId: Id<"contents">; slug: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const data = useQuery(api.contents.get, { contentId });
  const [tab, setTab] = useState<Tab | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const base = `/w/${slug}`;
  const body = (() => {
    if (data === undefined) return <Loading />;
    const { content, media, captions, decision, comments, briefing, client } = data;
    const current: Tab = tab ?? (content.status === "ajuste" ? "ajustes" : "briefing");
    const tabs: { id: Tab; label: string }[] = [
      { id: "briefing", label: "Briefing" },
      { id: "legenda", label: captions.length > 1 ? `Legendas ${captions.length}` : "Legenda" },
      { id: "ajustes", label: comments.length ? `Ajustes ${comments.length}` : "Ajustes" },
      { id: "historico", label: "Histórico" },
    ];

    return (
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-texto-3">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: client.accentColor }} />
            {client.name}
          </span>
          <h2 id="ficha-titulo" className="titulo text-[34px] leading-[0.95]">{content.title}</h2>
          <span className="text-sm capitalize text-texto-2">
            {longDate(content.date)}
            {content.time ? `, ${content.time}` : ""}. {PLATFORM[content.platform]}, {FORMAT[content.format].toLowerCase()}
          </span>
          <StatusMenu contentId={contentId} status={content.status} editable />
          <TaskEditor
            key={`${content.owner}-${content.dueDate}`}
            contentId={contentId}
            owner={content.owner}
            dueDate={content.dueDate}
            done={["aprovado", "agendado", "publicado"].includes(content.status)}
          />
        </header>

        {media.length === 0 ? (
          <p className="rounded-peca border border-dashed border-campo px-4 py-5 text-sm text-texto-2">Sem mídia ainda.</p>
        ) : (
          <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Mídias da peça">
            {media.map((m) => (
              <li key={m._id} className="h-36 w-[115px] shrink-0 overflow-hidden rounded-xl bg-thumb">
                {m.kind === "video" && m.url ? (
                  <video src={m.url} muted playsInline preload="metadata" className="size-full object-cover" />
                ) : m.kind === "imagem" && m.url ? (
                  <img src={m.url} alt={m.alt ?? ""} className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center p-2 text-center text-xs text-texto-2">Link</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2.5">
          <Link href={`${base}/c/${contentId}/editar`} className={`${buttonClass.primary} min-h-11 px-5 text-sm`}>
            Editar peça
          </Link>
          <Link href={`${base}/c/${contentId}`} className={`${buttonClass.outline} min-h-11 px-5 text-sm`}>
            Ver como a cliente vê
          </Link>
        </div>

        <div>
          <div role="tablist" aria-label="Ficha da peça" className="flex gap-5 overflow-x-auto border-b border-linha">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`ficha-tab-${t.id}`}
                aria-selected={current === t.id}
                aria-controls={`ficha-painel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`min-h-11 shrink-0 text-[15px] ${current === t.id ? "font-bold shadow-[inset_0_-2px_0_var(--color-vinho)]" : "text-texto-2"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`ficha-painel-${current}`} aria-labelledby={`ficha-tab-${current}`} className="pt-5">
            {current === "briefing" &&
              (briefing ? (
                <div className="flex flex-col gap-4">
                  <span className="text-sm text-texto-2">
                    Aberto por {briefing.authorName}, {stamp(briefing.at)}
                    {briefing.desiredDate ? `. Pedido para ${longDate(briefing.desiredDate)}` : ""}
                  </span>
                  {briefing.objective && (
                    <span className="self-start rounded-full bg-rosa px-3 py-1 text-sm font-semibold text-vinho">{briefing.objective}</span>
                  )}
                  <p className="whitespace-pre-wrap text-base leading-relaxed">{briefing.body}</p>
                  {briefing.links.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {briefing.links.map((l) => (
                        <li key={l}>
                          <a href={l} target="_blank" rel="noreferrer" className="break-all text-sm font-semibold text-rosa-forte underline">
                            {l}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href={`${base}/briefing/${briefing._id}`} className="min-h-11 content-center self-start text-sm font-semibold text-rosa-forte">
                    Abrir ou editar o briefing
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-base text-texto-2">Esta peça nasceu sem briefing.</p>
                  <Link href={`${base}/briefing/novo?conteudo=${contentId}`} className={`${buttonClass.secondary} min-h-11 self-start px-5 text-sm`}>
                    Escrever o briefing
                  </Link>
                </div>
              ))}
            {current === "legenda" && (
              <div className="flex flex-col gap-3">
                <CaptionPicker captions={captions} locked studio />
                <Link href={`${base}/c/${contentId}/editar`} className="min-h-11 content-center self-start text-sm font-semibold text-rosa-forte">
                  Editar legendas
                </Link>
              </div>
            )}
            {current === "ajustes" && (
              <div className="flex flex-col gap-5">
                {decision && (
                  <div
                    className="flex flex-col gap-1 border-l-[3px] pl-3 text-sm"
                    style={{ borderColor: decision.type === "ajuste" ? "var(--color-st-ajuste)" : "var(--color-rosa-forte)" }}
                  >
                    <span>
                      <strong>{decision.label}</strong> por {decision.userName}, {stamp(decision.at)}
                    </span>
                    {decision.comment && <span className="text-texto-2">&ldquo;{decision.comment}&rdquo;</span>}
                  </div>
                )}
                <CommentThread contentId={contentId} comments={comments} accent={client.accentColor} />
              </div>
            )}
            {current === "historico" && <HistoryList contentId={contentId} />}
          </div>
        </div>
        <div className="border-t border-linha pt-3">
          <TrashButton contentId={contentId} title={content.title} editable variant="text" onDone={() => ref.current?.close()} />
        </div>
      </div>
    );
  })();

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-labelledby="ficha-titulo"
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-[560px] bg-creme p-0 text-vinho backdrop:bg-vinho/40"
    >
      <div className="flex min-h-full flex-col gap-4 px-6 pb-10 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-texto-2">Ficha da peça</span>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Fechar ficha"
            className="flex size-11 items-center justify-center rounded-full text-2xl hover:bg-white"
          >
            ×
          </button>
        </div>
        {body}
      </div>
    </dialog>
  );
}
