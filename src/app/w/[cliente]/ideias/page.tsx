"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useRef, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Loading, buttonClass } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { useWorkspace } from "@/components/WorkspaceShell";
import { shortDate, stamp, todayISO } from "@/lib/dates";

const STATUS_TEXT = {
  nova: { label: "Nova", color: "var(--color-rosa-forte)" },
  analise: { label: "Em análise pelo estúdio", color: "var(--color-st-aguardando)" },
  convertida: { label: "Virou conteúdo", color: "var(--color-st-agendado)" },
  arquivada: { label: "Arquivada", color: "var(--color-st-ideia)" },
} as const;

const field = "border-[1.5px] border-campo bg-white px-3 text-base font-normal";
const MAX_BYTES = 25 * 1024 * 1024;

export default function IdeiasPage() {
  const ws = useWorkspace();
  const ideas = useQuery(api.ideas.list, { slug: ws.slug });
  const create = useMutation(api.ideas.create);
  const uploadUrl = useMutation(api.ideas.generateUploadUrl);
  const setStatus = useMutation(api.ideas.setStatus);
  const remove = useMutation(api.ideas.remove);
  const form = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const admin = ws.viewerRole === "admin";
  const base = `/w/${ws.slug}`;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const file = d.get("arquivo") as File | null;
    setPending(true);
    setError(null);
    setSent(false);
    try {
      let fileId: Id<"_storage"> | undefined;
      if (file && file.size > 0) {
        if (file.size > MAX_BYTES) throw new Error("O arquivo passa de 25 MB. Mande um link no lugar.");
        const url = await uploadUrl();
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
        if (!res.ok) throw new Error("Não foi possível enviar o arquivo.");
        fileId = ((await res.json()) as { storageId: Id<"_storage"> }).storageId;
      }
      await create({
        slug: ws.slug,
        title: String(d.get("titulo") ?? ""),
        description: String(d.get("descricao") ?? ""),
        link: String(d.get("link") ?? ""),
        fileId,
      });
      form.current?.reset();
      setSent(true);
    } catch (err) {
      setError(err instanceof Error && !("data" in err) ? err.message : errorText(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pb-12 pt-4">
      <header className="flex flex-col gap-2">
        <h1 className="titulo text-5xl md:text-7xl">Caixa de Ideias</h1>
        <p className="text-base leading-relaxed text-texto-3">
          {admin ? `Ideias enviadas por ${ws.name}. Leve as boas para o calendário.` : "Viu algo que gostaria de fazer? Mande aqui. O estúdio transforma em conteúdo."}
        </p>
      </header>

      <form ref={form} onSubmit={submit} className="flex flex-col gap-4 rounded-peca bg-white p-5">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Título
          <input name="titulo" required placeholder="Ex.: mitos sobre gelo e calor" className={`${field} min-h-12`} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Descrição
          <textarea name="descricao" rows={3} placeholder="Conte a ideia do seu jeito" className={`${field} resize-y py-2.5`} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Link de referência
          <input name="link" type="url" inputMode="url" placeholder="Cole o link do post ou vídeo" className={`${field} min-h-12`} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Arquivo (print, foto, PDF)
          <input name="arquivo" type="file" accept="image/*,video/*,application/pdf" className="text-sm font-normal file:mr-3 file:min-h-10 file:rounded-full file:border-[1.5px] file:border-vinho file:bg-white file:px-4 file:font-semibold file:text-vinho" />
        </label>
        {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
        {sent && <p role="status" className="text-sm font-semibold text-st-agendado">Ideia enviada. O estúdio já pode ver.</p>}
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Enviando" : "Enviar ideia"}
        </button>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="text-[22px] font-extrabold tracking-[-0.045em]">Enviadas</h2>
        {ideas === undefined ? (
          <Loading />
        ) : ideas.length === 0 ? (
          <p className="text-base text-texto-2">Nenhuma ideia ainda.</p>
        ) : (
          <ul className="flex flex-col">
            {ideas.map((i) => {
              const st = STATUS_TEXT[i.status];
              return (
                <li key={i._id} className="flex flex-col gap-2 border-t border-linha py-4 last:border-b">
                  <strong className="text-base leading-snug">{i.title}</strong>
                  {i.description && <p className="whitespace-pre-line text-[15px] leading-relaxed text-texto-3">{i.description}</p>}
                  <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {i.link && <a href={i.link} target="_blank" rel="noreferrer" className="font-semibold text-rosa-forte underline">Ver referência</a>}
                    {i.fileUrl && <a href={i.fileUrl} target="_blank" rel="noreferrer" className="font-semibold text-rosa-forte underline">Ver arquivo</a>}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                    <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: st.color }}>
                      <span className="size-2 rounded-full" style={{ background: st.color }} />
                      {i.status === "convertida" && i.content ? `Virou conteúdo em ${shortDate(i.content.date)}` : st.label}
                    </span>
                    <span className="text-texto-2">{i.authorName}, {stamp(i.at)}</span>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    {i.content && (
                      <Link href={`${base}/c/${i.content._id}`} className="inline-flex min-h-9 items-center text-sm font-semibold text-rosa-forte">
                        Abrir conteúdo
                      </Link>
                    )}
                    {admin && i.status !== "convertida" && (
                      <>
                        <Link
                          href={`${base}/novo?data=${todayISO()}&tema=${encodeURIComponent(i.title)}&ideia=${i._id}`}
                          className="inline-flex min-h-9 items-center rounded-full bg-vinho px-4 text-sm font-semibold text-white"
                        >
                          Levar ao calendário
                        </Link>
                        {i.status === "nova" && (
                          <button type="button" onClick={() => setStatus({ ideaId: i._id as Id<"ideas">, status: "analise" })} className="min-h-9 rounded-full border border-campo px-3.5 text-sm font-semibold">
                            Marcar em análise
                          </button>
                        )}
                        {i.status !== "arquivada" ? (
                          <button type="button" onClick={() => setStatus({ ideaId: i._id as Id<"ideas">, status: "arquivada" })} className="min-h-9 px-2 text-sm font-semibold text-texto-2">
                            Arquivar
                          </button>
                        ) : (
                          <button type="button" onClick={() => setStatus({ ideaId: i._id as Id<"ideas">, status: "nova" })} className="min-h-9 px-2 text-sm font-semibold text-texto-2">
                            Reabrir
                          </button>
                        )}
                      </>
                    )}
                    {!admin && i.isMine && i.status === "nova" && (
                      <button
                        type="button"
                        onClick={() => confirm("Apagar esta ideia?") && remove({ ideaId: i._id as Id<"ideas"> }).catch((e) => setError(errorText(e)))}
                        className="min-h-9 px-1 text-sm font-semibold text-texto-2"
                      >
                        Apagar
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
