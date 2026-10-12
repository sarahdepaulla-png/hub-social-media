"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";

/** Faixa fixa no topo enquanto a admin vê o Hub como a cliente. */
export function ViewAsBanner() {
  const me = useQuery(api.viewer.me, {});
  const setViewAs = useMutation(api.viewer.setViewAs);
  const [leaving, setLeaving] = useState(false);
  if (!me?.viewingAs) return null;
  const leave = async () => {
    setLeaving(true);
    await setViewAs({});
    // Volta para o mesmo espaço, já como estúdio.
    window.location.href = me.client ? `/w/${me.client.slug}` : "/estudio";
  };
  return (
    <div role="status" className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-vinho px-4 py-2 text-center text-sm text-white">
      <span>
        Você está vendo como a cliente{me.client ? <strong> {me.client.name}</strong> : null}. Aprovar e pedir ajuste ficam bloqueados.
      </span>
      <button type="button" onClick={() => void leave()} disabled={leaving} className="min-h-9 rounded-full bg-rosa px-4 font-bold text-vinho disabled:opacity-60">
        {leaving ? "Voltando" : "Voltar para o estúdio"}
      </button>
    </div>
  );
}

/** Botão do estúdio: abre este espaço como a cliente vê. */
export function ViewAsButton({ slug }: { slug: string }) {
  const setViewAs = useMutation(api.viewer.setViewAs);
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await setViewAs({ slug });
        // Recarrega a página inteira: o servidor também precisa enxergar o modo novo.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `/w/${slug}`;
      }}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border-[1.5px] border-vinho px-3.5 text-sm font-semibold hover:bg-white disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {pending ? "Abrindo" : "Ver como cliente"}
    </button>
  );
}
