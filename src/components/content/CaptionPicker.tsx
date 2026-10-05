"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type Caption = { _id: string; order: number; text: string; cta: string | null; hashtags: string | null; notes: string | null; chosen: boolean };

/** Opções de legenda. A cliente toca na favorita e isso fica registrado. */
export function CaptionPicker({ captions, locked }: { captions: Caption[]; locked: boolean }) {
  const choose = useMutation(api.contents.chooseCaption).withOptimisticUpdate((store, { captionId }) => {
    for (const { args, value } of store.getAllQueries(api.contents.get)) {
      if (!value) continue;
      store.setQuery(api.contents.get, args, {
        ...value,
        captions: value.captions.map((c) => ({ ...c, chosen: c._id === captionId })),
      });
    }
  });

  if (captions.length === 0) {
    return <p className="text-base text-texto-2">O estúdio ainda está escrevendo as legendas.</p>;
  }

  const chosen = captions.find((c) => c.chosen) ?? (captions.length === 1 ? captions[0] : null);

  return (
    <div className="flex flex-col gap-3">
      {captions.length > 1 && (
        <span className="text-sm text-texto-2">{locked ? "Legenda escolhida para esta peça." : "Toque na legenda que você prefere."}</span>
      )}
      <fieldset className="flex flex-col gap-2.5" disabled={locked}>
        <legend className="sr-only">Opções de legenda</legend>
        {captions.map((c) => (
          <label
            key={c._id}
            className={`flex cursor-pointer gap-3 rounded-peca border-2 bg-white p-4 transition-colors ${
              c.chosen ? "border-vinho" : "border-linha hover:border-campo"
            } ${locked && !c.chosen ? "opacity-60" : ""}`}
          >
            {captions.length > 1 && (
              <input
                type="radio"
                name="legenda"
                checked={c.chosen}
                onChange={() => choose({ captionId: c._id as Id<"captions"> })}
                className="mt-1 size-[18px] shrink-0 accent-rosa-forte"
              />
            )}
            <span className="flex flex-col gap-1.5">
              <strong className="text-sm">
                {captions.length > 1 ? `Opção ${c.order}` : "Legenda"}
                {c.chosen && captions.length > 1 && <span className="font-medium text-rosa-forte"> (sua favorita)</span>}
              </strong>
              <span className="whitespace-pre-line text-[15px] leading-relaxed text-texto-3">{c.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {chosen && (chosen.cta || chosen.hashtags || chosen.notes) && (
        <dl className="mt-1 grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm leading-relaxed">
          {chosen.cta && (
            <>
              <dt className="font-semibold">CTA</dt>
              <dd>{chosen.cta}</dd>
            </>
          )}
          {chosen.hashtags && (
            <>
              <dt className="font-semibold">Hashtags</dt>
              <dd className="break-words text-rosa-forte">{chosen.hashtags}</dd>
            </>
          )}
          {chosen.notes && (
            <>
              <dt className="font-semibold">Observação</dt>
              <dd className="text-texto-2">{chosen.notes}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
