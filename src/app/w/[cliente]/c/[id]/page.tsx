"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Loading, StatusTag, buttonClass } from "@/components/brand";
import { CaptionPicker } from "@/components/content/CaptionPicker";
import { CommentThread, HistoryList } from "@/components/content/CommentThread";
import { DecisionSheet } from "@/components/content/DecisionSheet";
import { MediaViewer, PostBar } from "@/components/content/MediaViewer";
import { longDate, stamp } from "@/lib/dates";
import { FORMAT, PLATFORM } from "@/lib/labels";

type Tab = "legenda" | "comentarios" | "historico";

export default function ConteudoPage() {
  const { cliente, id } = useParams<{ cliente: string; id: string }>();
  const contentId = id as Id<"contents">;
  const data = useQuery(api.contents.get, { contentId });
  const [tab, setTab] = useState<Tab>("legenda");
  const [sheet, setSheet] = useState<null | "aprovar" | "ajuste">(null);
  const [card, setCard] = useState(0);
  const [justApproved, setJustApproved] = useState(false);
  const onIndex = useCallback((i: number) => setCard(i), []);

  if (data === undefined) return <Loading />;
  const { content, media, captions, decision, comments, queue, viewer, client } = data;
  const base = `/w/${cliente}`;
  const waiting = content.status === "aguardando";
  const chosen = captions.find((c) => c.chosen);
  const rootComments = comments.length;

  const tabs: { id: Tab; label: string }[] = [
    { id: "legenda", label: captions.length > 1 ? `Legendas ${captions.length}` : "Legenda" },
    { id: "comentarios", label: rootComments ? `Comentários ${rootComments}` : "Comentários" },
    { id: "historico", label: "Histórico" },
  ];

  return (
    <main className={`mx-auto w-full max-w-6xl ${waiting ? "pb-28" : "pb-12"} md:px-6 md:pt-4`}>
      <div className="flex items-center justify-between gap-3 px-2 pb-2 md:px-0">
        <Link href={base} className="flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-texto-3 hover:text-vinho">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          Início
        </Link>
        <span className="flex items-center gap-3 pr-3 md:pr-0">
          {waiting && queue.remaining > 0 && <span className="text-[13px] text-texto-2">+{queue.remaining} esperando você</span>}
          <span className="rounded-full border border-campo px-2.5 py-0.5 text-xs font-semibold">v{content.version}</span>
          {viewer.role === "admin" && (
            <Link href={`${base}/c/${content._id}/editar`} className="min-h-9 rounded-full bg-vinho px-4 text-sm font-semibold leading-9 text-white">
              Editar
            </Link>
          )}
        </span>
      </div>

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,440px)] md:items-start md:gap-12">
        <div className="md:sticky md:top-4">
          <MediaViewer
            media={media}
            format={content.format}
            status={content.status}
            externalUrl={content.externalUrl}
            justApproved={justApproved}
            onIndexChange={onIndex}
          />
          {content.platform === "instagram" && media.length > 0 && <PostBar />}
        </div>

        <div className="flex flex-col gap-6 px-6 pt-6 md:px-0 md:pt-2">
          <header className="flex flex-col gap-2.5">
            <span className="text-sm capitalize text-texto-2">
              {longDate(content.date)}
              {content.time ? `, ${content.time}` : ""}. {PLATFORM[content.platform]}, {FORMAT[content.format].toLowerCase()}
              {media.length > 1 ? `, ${media.length} cards` : ""}
            </span>
            <h1 className="titulo text-[34px] leading-[0.95] md:text-5xl">{content.title}</h1>
            <StatusTag status={content.status} />
            {(content.objective || content.pillar) && (
              <dl className="mt-1 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                {content.objective && (
                  <>
                    <dt className="text-texto-2">Objetivo</dt>
                    <dd>{content.objective}</dd>
                  </>
                )}
                {content.pillar && (
                  <>
                    <dt className="text-texto-2">Pilar</dt>
                    <dd className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="size-2" style={{ background: client.accentColor }} />
                      {content.pillar}
                    </dd>
                  </>
                )}
              </dl>
            )}
          </header>

          {decision && (
            <div className="flex flex-col gap-1 border-l-[3px] pl-3 text-sm" style={{ borderColor: decision.type === "ajuste" ? "var(--color-st-ajuste)" : "var(--color-rosa-forte)" }}>
              <span>
                <strong>{decision.label}</strong> por {decision.isMine ? "você" : decision.userName}, {stamp(decision.at)}
              </span>
              {decision.comment && <span className="text-texto-2">&ldquo;{decision.comment}&rdquo;</span>}
            </div>
          )}

          <div>
            <div role="tablist" aria-label="Detalhes da peça" className="flex gap-6 border-b border-linha">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls={`painel-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={`min-h-11 text-[15px] ${tab === t.id ? "font-bold shadow-[inset_0_-2px_0_var(--color-vinho)]" : "text-texto-2"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div role="tabpanel" id={`painel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-5">
              {tab === "legenda" && <CaptionPicker captions={captions} locked={!waiting && viewer.role !== "admin"} />}
              {tab === "comentarios" && <CommentThread contentId={contentId} comments={comments} accent={client.accentColor} />}
              {tab === "historico" && <HistoryList contentId={contentId} />}
            </div>
          </div>
        </div>
      </div>

      {waiting && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 md:static md:mt-10 md:border-0 md:bg-transparent md:px-0">
          <div className="mx-auto flex max-w-6xl gap-2.5 md:justify-end">
            <button type="button" onClick={() => setSheet("ajuste")} className={`${buttonClass.danger} flex-1 md:flex-none`}>
              Solicitar ajuste
            </button>
            <button type="button" onClick={() => setSheet("aprovar")} className={`${buttonClass.primary} flex-[1.2] md:flex-none`}>
              Aprovar
            </button>
          </div>
        </div>
      )}

      <DecisionSheet
        open={sheet !== null}
        initial={sheet ?? "aprovar"}
        onClose={() => setSheet(null)}
        contentId={contentId}
        title={content.title}
        captionLabel={chosen && captions.length > 1 ? `legenda opção ${chosen.order}` : null}
        cardIndex={card}
        cardCount={media.length}
        nextHref={queue.nextId ? `${base}/c/${queue.nextId}` : null}
        remaining={queue.remaining}
        onDecided={(d) => setJustApproved(d.type !== "ajuste")}
      />
    </main>
  );
}
