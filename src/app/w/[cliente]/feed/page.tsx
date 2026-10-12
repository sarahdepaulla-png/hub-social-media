"use client";

import { FeedPreview } from "@/components/feed/FeedPreview";
import { useWorkspace } from "@/components/WorkspaceShell";

export default function FeedPage() {
  const ws = useWorkspace();
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-16 pt-4 md:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="titulo text-5xl md:text-6xl">Feed</h1>
        <p className="text-base text-texto-2">
          Use o + azul, cole o link do post ou aperte Ctrl+V com uma imagem copiada. Arraste os posts para mudar a ordem; toque num post para enquadrar,
          fixar ou tirar. &ldquo;Baixar imagem&rdquo; gera um PNG para mandar no WhatsApp.
        </p>
      </header>
      <FeedPreview slug={ws.slug} />
    </main>
  );
}
