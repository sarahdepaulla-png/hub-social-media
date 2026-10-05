"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { Suspense } from "react";
import { api } from "@convex/_generated/api";
import { Asterisk } from "@/components/brand";
import { BriefingForm } from "@/components/briefing/BriefingForm";
import { useWorkspace } from "@/components/WorkspaceShell";

function NovoBriefing() {
  const ws = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const create = useMutation(api.briefings.create);
  const admin = ws.viewerRole === "admin";
  const date = params.get("data");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pb-16 pt-4">
      <header className="flex flex-col gap-3">
        <Link href={`/w/${ws.slug}`} className="min-h-11 content-center self-start text-sm font-semibold text-rosa-forte">
          Voltar para o início
        </Link>
        <h1 className="titulo flex items-center gap-3 text-[52px] md:text-[88px]">
          Briefing <Asterisk size={40} color="var(--color-rosa)" className="md:size-16" />
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-texto-3">
          {admin
            ? `Novo pedido de conteúdo para ${ws.name}. Ele entra na esteira e, quando a criação começar, vira uma peça do calendário.`
            : "Conte o que você quer publicar. O estúdio recebe na hora e, quando começar a criação, a peça aparece no seu calendário."}
        </p>
      </header>
      <BriefingForm
        initial={{ desiredDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined, title: params.get("tema") ?? "" }}
        submitLabel={admin ? "Salvar na esteira" : "Enviar para o estúdio"}
        pendingLabel="Enviando"
        onSubmit={async (v) => {
          const id = await create({ slug: ws.slug, ...v });
          router.replace(`/w/${ws.slug}/briefing/${id}?enviado=1`);
        }}
      />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <NovoBriefing />
    </Suspense>
  );
}
