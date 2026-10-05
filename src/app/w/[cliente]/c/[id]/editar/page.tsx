"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Loading, StatusTag, buttonClass } from "@/components/brand";
import { CommentThread, HistoryList } from "@/components/content/CommentThread";
import { errorText } from "@/components/content/DecisionSheet";
import { CaptionEditor } from "@/components/editor/CaptionEditor";
import { ContentForm } from "@/components/editor/ContentForm";
import { MediaManager } from "@/components/editor/MediaManager";
import { CoverPicker } from "@/components/editor/CoverPicker";
import { AutoCovers } from "@/components/AutoCovers";
import { STATUS, type Status } from "@/lib/labels";

export default function EditarPage() {
  const { cliente, id } = useParams<{ cliente: string; id: string }>();
  const contentId = id as Id<"contents">;
  const data = useQuery(api.contents.get, { contentId });
  const setStatus = useMutation(api.contents.setStatus);
  const newVersion = useMutation(api.contents.newVersion);
  const [side, setSide] = useState<"conversa" | "historico">("conversa");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (data === undefined) return <Loading />;
  if (data.viewer.role !== "admin") {
    return <p className="px-6 py-16 text-lg">Só a administradora edita conteúdos.</p>;
  }
  const { content, media, captions, comments, client } = data;
  const base = `/w/${cliente}`;

  const run = async (fn: () => Promise<unknown>) => {
    setPending(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  };

  const canSend = content.status === "ideia" || content.status === "producao" || content.status === "ajuste";
  const canVersion = content.status === "ajuste" || content.status === "aprovado" || content.status === "aguardando";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-16 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-linha pb-5">
        <div className="flex flex-col gap-1.5">
          <Link href={`${base}/c/${content._id}`} className="text-sm font-semibold text-rosa-forte">
            Ver como a cliente vê
          </Link>
          <h1 className="titulo text-4xl">{content.title}</h1>
          <span className="flex items-center gap-3">
            <StatusTag status={content.status} />
            <span className="rounded-full border border-campo px-2.5 py-0.5 text-xs font-semibold">versão {content.version}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-2 text-sm font-semibold">
            Status
            <select
              value={content.status}
              onChange={(e) => run(() => setStatus({ contentId, status: e.target.value as Status }))}
              className="min-h-11 border border-campo bg-white px-3 text-[15px] font-normal"
            >
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </label>
          {canVersion && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => newVersion({ contentId, copyMedia: true }))}
              className={buttonClass.outline}
              title="Guarda a versão atual e abre uma nova com a mesma mídia, para você trocar só o que mudou"
            >
              Abrir versão {content.version + 1}
            </button>
          )}
          {canSend && (
            <button type="button" disabled={pending} onClick={() => run(() => setStatus({ contentId, status: "aguardando" }))} className={buttonClass.primary}>
              Enviar para aprovação
            </button>
          )}
        </div>
        {error && <p role="alert" className="w-full text-sm font-semibold text-st-ajuste-texto">{error}</p>}
      </div>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-12">
          <MediaManager contentId={contentId} media={media} version={content.version} />
          <CoverPicker contentId={contentId} coverUrl={content.coverUrl} coverSource={content.coverSource} />
          <AutoCovers contentId={contentId} />
          <ContentForm
            key={`${content._id}-${content.version}`}
            contentId={contentId}
            initial={{
              date: content.date,
              time: content.time ?? "",
              platform: content.platform,
              format: content.format,
              title: content.title,
              objective: content.objective ?? "",
              pillar: content.pillar ?? "",
              externalUrl: content.externalUrl ?? "",
            }}
          />
          <CaptionEditor key={captions.map((c) => c._id).join()} contentId={contentId} captions={captions} />
        </div>

        <aside aria-label="Conversa e histórico" className="flex flex-col gap-5 self-start bg-white p-5 lg:sticky lg:top-4">
          <div role="tablist" className="flex gap-5 border-b border-linha">
            {(["conversa", "historico"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={side === t}
                onClick={() => setSide(t)}
                className={`min-h-11 text-[15px] ${side === t ? "font-bold shadow-[inset_0_-2px_0_var(--color-vinho)]" : "text-texto-2"}`}
              >
                {t === "conversa" ? `Conversa ${comments.length || ""}` : "Histórico"}
              </button>
            ))}
          </div>
          {side === "conversa" ? (
            <CommentThread contentId={contentId} comments={comments} accent={client.accentColor} />
          ) : (
            <HistoryList contentId={contentId} />
          )}
        </aside>
      </div>
    </main>
  );
}
