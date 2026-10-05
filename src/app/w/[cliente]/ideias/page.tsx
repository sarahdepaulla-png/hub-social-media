"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@convex/_generated/dataModel";
import { Asterisk, Loading, buttonClass } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { useWorkspace } from "@/components/WorkspaceShell";
import { shortDate, stamp, todayISO } from "@/lib/dates";

type Idea = FunctionReturnType<typeof api.ideas.list>[number];
type Filter = "todas" | "nova" | "analise" | "convertida" | "arquivada";

const PLATFORM = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  site: "Site",
} as const;

const STATUS = {
  nova: { label: "Nova", color: "var(--color-rosa-forte)" },
  analise: { label: "Em análise", color: "var(--color-st-aguardando)" },
  convertida: { label: "Virou conteúdo", color: "var(--color-st-agendado)" },
  arquivada: { label: "Arquivada", color: "var(--color-st-ideia)" },
} as const;

const field = "w-full border-[1.5px] border-campo bg-white px-3 text-base font-normal";
const MAX_BYTES = 25 * 1024 * 1024;

function Composer({ slug, admin }: { slug: string; admin: boolean }) {
  const create = useMutation(api.ideas.create);
  const uploadUrl = useMutation(api.ideas.generateUploadUrl);
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const file = d.get("arquivo") as File | null;
    setPending(true);
    setError(null);
    try {
      let fileId: Id<"_storage"> | undefined;
      if (file && file.size > 0) {
        if (file.size > MAX_BYTES) throw new Error("O arquivo passa de 25 MB. Cole o link no lugar.");
        const url = await uploadUrl();
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
        if (!res.ok) throw new Error("Não foi possível enviar o arquivo.");
        fileId = ((await res.json()) as { storageId: Id<"_storage"> }).storageId;
      }
      await create({
        slug,
        link: String(d.get("link") ?? ""),
        title: String(d.get("titulo") ?? ""),
        adaptation: String(d.get("adaptacao") ?? ""),
        fileId,
      });
      form.current?.reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error && !("data" in err) ? err.message : errorText(err));
    } finally {
      setPending(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${buttonClass.primary} self-start`}>
        Adicionar referência
      </button>
    );
  }

  return (
    <form ref={form} onSubmit={submit} className="flex flex-col gap-4 rounded-peca bg-white p-5 shadow-flutua md:max-w-2xl">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Link do post, vídeo ou perfil
        <input name="link" type="url" inputMode="url" autoFocus placeholder="https://www.instagram.com/p/..." className={`${field} min-h-12`} />
        <span className="font-normal text-texto-2">A imagem do link aparece sozinha no cartão.</span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {admin ? "Como dá para adaptar" : "O que você gostou e como imagina para você"}
        <textarea
          name="adaptacao"
          rows={3}
          placeholder={admin ? "Ex.: mesmo formato de lista, mas com os erros que a Vivi vê na clínica" : "Ex.: gostei do jeito que ela explica com o boneco"}
          className={`${field} resize-y py-2.5`}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Título (opcional)
          <input name="titulo" placeholder="Ex.: mitos sobre gelo e calor" className={`${field} min-h-11`} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Print ou arquivo (opcional)
          <input
            name="arquivo"
            type="file"
            accept="image/*,video/*,application/pdf"
            className="text-sm font-normal file:mr-3 file:min-h-10 file:rounded-full file:border-[1.5px] file:border-vinho file:bg-white file:px-4 file:font-semibold file:text-vinho"
          />
        </label>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Salvando" : "Colocar no mural"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass.outline}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function CardImage({ idea }: { idea: Idea }) {
  const retry = useMutation(api.ideas.retryPreview);
  const label = idea.platform ? PLATFORM[idea.platform] : "Ideia";
  const inner = idea.imageUrl ? (
    <img src={idea.imageUrl} alt="" className="block w-full object-cover" style={{ maxHeight: 520 }} />
  ) : (
    <span className="grade-rosa flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 p-4 text-center">
      {idea.previewPending ? (
        <>
          <Asterisk size={30} color="var(--color-vinho)" spinning />
          <span className="text-sm font-semibold text-vinho">Buscando a imagem do link</span>
        </>
      ) : (
        <>
          <span className="titulo text-4xl text-white">{label}</span>
          {idea.site && <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-vinho">{idea.site}</span>}
        </>
      )}
    </span>
  );
  return (
    <div className="relative overflow-hidden rounded-t-peca bg-thumb">
      {idea.link ? (
        <a href={idea.link} target="_blank" rel="noreferrer" aria-label={`Abrir a referência no ${label}`} className="block">
          {inner}
        </a>
      ) : (
        inner
      )}
      {idea.platform && (
        <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-vinho">{label}</span>
      )}
      {idea.link && !idea.imageUrl && !idea.previewPending && idea.canEdit && (
        <button
          type="button"
          onClick={() => retry({ ideaId: idea._id as Id<"ideas"> })}
          className="absolute bottom-2.5 right-2.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-vinho"
        >
          Buscar imagem de novo
        </button>
      )}
    </div>
  );
}

function EditCard({ idea, onDone }: { idea: Idea; onDone: () => void }) {
  const update = useMutation(api.ideas.update);
  const uploadUrl = useMutation(api.ideas.generateUploadUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const file = d.get("arquivo") as File | null;
    setPending(true);
    setError(null);
    try {
      let fileId: Id<"_storage"> | undefined;
      if (file && file.size > 0) {
        if (file.size > MAX_BYTES) throw new Error("O arquivo passa de 25 MB.");
        const url = await uploadUrl();
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
        if (!res.ok) throw new Error("Não foi possível enviar o arquivo.");
        fileId = ((await res.json()) as { storageId: Id<"_storage"> }).storageId;
      }
      await update({
        ideaId: idea._id as Id<"ideas">,
        title: String(d.get("titulo") ?? ""),
        link: String(d.get("link") ?? ""),
        description: String(d.get("descricao") ?? ""),
        adaptation: String(d.get("adaptacao") ?? ""),
        fileId,
        removeFile: d.get("tirarArquivo") === "on" && !fileId,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error && !("data" in err) ? err.message : errorText(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-4">
      <strong className="text-base">Editar cartão</strong>
      <label className="flex flex-col gap-1 text-[13px] font-semibold">
        Título
        <input name="titulo" defaultValue={idea.title} className={`${field} min-h-11`} />
      </label>
      <label className="flex flex-col gap-1 text-[13px] font-semibold">
        Link
        <input name="link" type="url" defaultValue={idea.link ?? ""} placeholder="https://" className={`${field} min-h-11`} />
        <span className="font-normal text-texto-2">Trocou o link? A imagem é buscada de novo.</span>
      </label>
      <label className="flex flex-col gap-1 text-[13px] font-semibold">
        Como adaptar
        <textarea name="adaptacao" rows={3} defaultValue={idea.adaptation ?? ""} className={`${field} resize-y py-2`} />
      </label>
      <label className="flex flex-col gap-1 text-[13px] font-semibold">
        Descrição
        <textarea name="descricao" rows={2} defaultValue={idea.description ?? ""} className={`${field} resize-y py-2`} />
      </label>
      <label className="flex flex-col gap-1 text-[13px] font-semibold">
        {idea.hasFile ? "Trocar imagem ou arquivo" : "Imagem ou arquivo (troca a imagem do cartão)"}
        <input
          name="arquivo"
          type="file"
          accept="image/*,video/*,application/pdf"
          className="text-sm font-normal file:mr-3 file:min-h-9 file:rounded-full file:border-[1.5px] file:border-vinho file:bg-white file:px-3 file:font-semibold file:text-vinho"
        />
      </label>
      {idea.hasFile && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="tirarArquivo" className="size-4 accent-rosa-forte" />
          Tirar o arquivo e usar a imagem do link
        </label>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
      <span className="flex gap-2">
        <button type="submit" disabled={pending} className="min-h-10 rounded-full bg-vinho px-5 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "Salvando" : "Salvar"}
        </button>
        <button type="button" onClick={onDone} className="min-h-10 px-3 text-sm font-semibold text-texto-2">
          Cancelar
        </button>
      </span>
    </form>
  );
}

function Conversation({ idea }: { idea: Idea }) {
  const add = useMutation(api.ideas.addComment);
  const removeComment = useMutation(api.ideas.removeComment);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3 border-t border-linha pt-3">
      {idea.comments.length === 0 && <p className="text-sm text-texto-2">Ninguém comentou ainda.</p>}
      {idea.comments.map((c) => (
        <div key={c._id} className="flex gap-2.5">
          <span
            aria-hidden="true"
            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${c.authorIsStudio ? "bg-vinho" : "bg-rosa-forte"}`}
          >
            {c.authorName.charAt(0).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-texto-2">
              <strong className="text-vinho">{c.authorName}</strong> {stamp(c.at)}
              {c.isMine && (
                <button type="button" onClick={() => removeComment({ commentId: c._id })} className="ml-2 font-semibold underline">
                  apagar
                </button>
              )}
            </span>
            <p className="whitespace-pre-line break-words text-sm leading-snug">{c.body}</p>
          </div>
        </div>
      ))}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          try {
            await add({ ideaId: idea._id as Id<"ideas">, body });
            setBody("");
            setError(null);
          } catch (err) {
            setError(errorText(err));
          }
        }}
        className="flex gap-2"
      >
        <label className="sr-only" htmlFor={`com-${idea._id}`}>Comentar</label>
        <input
          id={`com-${idea._id}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva um comentário"
          className={`${field} min-h-10 min-w-0 flex-1 text-[15px]`}
        />
        <button type="submit" disabled={!body.trim()} className="min-h-10 shrink-0 rounded-full bg-vinho px-4 text-sm font-semibold text-white disabled:opacity-40">
          Enviar
        </button>
      </form>
      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
    </div>
  );
}

function IdeaCard({ idea, admin, base }: { idea: Idea; admin: boolean; base: string }) {
  const setStatus = useMutation(api.ideas.setStatus);
  const remove = useMutation(api.ideas.remove);
  const toggleLike = useMutation(api.ideas.toggleLike).withOptimisticUpdate((store, { ideaId }) => {
    for (const { args, value } of store.getAllQueries(api.ideas.list)) {
      if (!value) continue;
      store.setQuery(
        api.ideas.list,
        args,
        value.map((i) =>
          i._id === ideaId ? { ...i, likes: { ...i.likes, mine: !i.likes.mine, count: i.likes.count + (i.likes.mine ? -1 : 1) } } : i,
        ),
      );
    }
  });
  const [editing, setEditing] = useState(false);
  const [talk, setTalk] = useState(false);
  const st = STATUS[idea.status];
  const title = idea.title.startsWith("Referência do") && idea.previewTitle ? idea.previewTitle : idea.title;

  return (
    <li className="mb-5 break-inside-avoid rounded-peca bg-white">
      <CardImage idea={idea} />
      {editing ? (
        <EditCard idea={idea} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <strong className="text-[17px] leading-snug">{title}</strong>
            {idea.canEdit && (
              <button type="button" onClick={() => setEditing(true)} className="min-h-8 shrink-0 rounded-full border border-campo px-3 text-xs font-semibold hover:border-vinho">
                Editar
              </button>
            )}
          </div>
          {idea.description && <p className="whitespace-pre-line text-sm leading-relaxed text-texto-3">{idea.description}</p>}
          {idea.adaptation ? (
            <div className="-rotate-1 bg-rosa px-3.5 pb-3 pt-2.5 text-vinho">
              <span className="text-xs font-bold">Como adaptar</span>
              <p className="whitespace-pre-line text-[15px] leading-snug">{idea.adaptation}</p>
            </div>
          ) : (
            idea.canEdit && (
              <button type="button" onClick={() => setEditing(true)} className="self-start rounded-md border border-dashed border-campo px-3 py-2 text-sm font-semibold text-texto-2 hover:border-vinho hover:text-vinho">
                + Como dá para adaptar
              </button>
            )
          )}
          {idea.fileUrl && (
            <a href={idea.fileUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-rosa-forte underline">
              Ver arquivo anexado
            </a>
          )}

          <div className="flex items-center gap-1 border-t border-linha pt-2">
            <button
              type="button"
              aria-pressed={idea.likes.mine}
              onClick={() => toggleLike({ ideaId: idea._id as Id<"ideas"> })}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold hover:bg-creme"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill={idea.likes.mine ? "var(--color-rosa-forte)" : "none"} stroke={idea.likes.mine ? "var(--color-rosa-forte)" : "currentColor"} strokeWidth="2">
                <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.2 3.1 4.5 6.9 4.5c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.8 0 6 3.7 4.5 7.3C19.5 16.4 12 21 12 21z" />
              </svg>
              {idea.likes.mine ? "Curtido" : "Curtir"}
              {idea.likes.count > 0 && <span className="text-texto-2">{idea.likes.count}</span>}
            </button>
            <button
              type="button"
              aria-expanded={talk}
              onClick={() => setTalk((t) => !t)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold hover:bg-creme"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20.5 11.5a8.5 8.5 0 01-12.6 7.4L3.5 20l1.2-4.2A8.5 8.5 0 1120.5 11.5z" />
              </svg>
              Comentar
              {idea.comments.length > 0 && <span className="text-texto-2">{idea.comments.length}</span>}
            </button>
          </div>
          {idea.likes.count > 0 && (
            <span className="-mt-2 text-xs text-texto-2">Curtido por {idea.likes.names.join(", ")}</span>
          )}
          {(talk || (idea.comments.length > 0 && idea.comments.length <= 2)) && <Conversation idea={idea} />}

          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: st.color }}>
              <span className="size-2 rounded-full" style={{ background: st.color }} />
              {idea.status === "convertida" && idea.content ? `Virou conteúdo em ${shortDate(idea.content.date)}` : st.label}
            </span>
            <span className="text-texto-2">
              {idea.authorIsStudio ? "Estúdio" : idea.authorName}, {stamp(idea.at)}
            </span>
          </span>
          <span className="flex flex-wrap gap-2">
            {idea.content && (
              <Link href={`${base}/c/${idea.content._id}`} className="inline-flex min-h-9 items-center text-sm font-semibold text-rosa-forte">
                Abrir conteúdo
              </Link>
            )}
            {admin && idea.status !== "convertida" && (
              <>
                <Link
                  href={`${base}/novo?data=${todayISO()}&tema=${encodeURIComponent(title)}&ideia=${idea._id}`}
                  className="inline-flex min-h-9 items-center rounded-full bg-vinho px-4 text-sm font-semibold text-white"
                >
                  Levar ao calendário
                </Link>
                {idea.status === "nova" && (
                  <button type="button" onClick={() => setStatus({ ideaId: idea._id as Id<"ideas">, status: "analise" })} className="min-h-9 rounded-full border border-campo px-3.5 text-sm font-semibold">
                    Em análise
                  </button>
                )}
                {idea.status !== "arquivada" ? (
                  <button type="button" onClick={() => setStatus({ ideaId: idea._id as Id<"ideas">, status: "arquivada" })} className="min-h-9 px-2 text-sm font-semibold text-texto-2">
                    Arquivar
                  </button>
                ) : (
                  <button type="button" onClick={() => setStatus({ ideaId: idea._id as Id<"ideas">, status: "analise" })} className="min-h-9 px-2 text-sm font-semibold text-texto-2">
                    Reabrir
                  </button>
                )}
              </>
            )}
            {!admin && idea.isMine && idea.status === "nova" && (
              <button
                type="button"
                onClick={() => confirm("Apagar esta referência?") && remove({ ideaId: idea._id as Id<"ideas"> })}
                className="min-h-9 px-1 text-sm font-semibold text-texto-2"
              >
                Apagar
              </button>
            )}
          </span>
        </div>
      )}
    </li>
  );
}

export default function IdeiasPage() {
  const ws = useWorkspace();
  const ideas = useQuery(api.ideas.list, { slug: ws.slug });
  const admin = ws.viewerRole === "admin";
  const [filter, setFilter] = useState<Filter>("todas");
  const base = `/w/${ws.slug}`;

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { todas: 0, nova: 0, analise: 0, convertida: 0, arquivada: 0 };
    for (const i of ideas ?? []) {
      c[i.status]++;
      if (i.status !== "arquivada") c.todas++;
    }
    return c;
  }, [ideas]);

  const visible = (ideas ?? []).filter((i) => (filter === "todas" ? i.status !== "arquivada" : i.status === filter));
  const filters: { id: Filter; label: string }[] = [
    { id: "todas", label: "Todas" },
    { id: "nova", label: "Novas" },
    { id: "analise", label: "Em análise" },
    { id: "convertida", label: "Viraram conteúdo" },
    ...(admin ? [{ id: "arquivada" as const, label: "Arquivadas" }] : []),
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 pb-14 pt-4 md:px-6">
      <header className="flex flex-col gap-3">
        <h1 className="titulo flex items-center gap-3 text-5xl md:text-7xl">
          Ideias e referências <Asterisk size={40} color="var(--color-rosa)" />
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-texto-3">
          {admin
            ? `Mural de ${ws.name}. Cole links de referência e anote como adaptar.`
            : "Viu algo que gostaria de fazer? Cole o link aqui e conte o que gostou. O estúdio adapta para você."}
        </p>
      </header>

      <Composer slug={ws.slug} admin={admin} />

      {ideas === undefined ? (
        <Loading />
      ) : (
        <>
          {ideas.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar ideias">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`min-h-10 shrink-0 rounded-full border px-4 text-sm ${
                    filter === f.id ? "border-vinho bg-vinho font-semibold text-white" : "border-campo bg-white"
                  }`}
                >
                  {f.label} {counts[f.id] > 0 && <span className="opacity-70">{counts[f.id]}</span>}
                </button>
              ))}
            </div>
          )}
          {visible.length === 0 ? (
            <p className="text-base text-texto-2">
              {ideas.length === 0 ? "O mural ainda está vazio. Comece colando um link de referência." : "Nada por aqui neste filtro."}
            </p>
          ) : (
            <ul className="columns-1 gap-5 sm:columns-2 lg:columns-3">
              {visible.map((i) => (
                <IdeaCard key={i._id} idea={i} admin={admin} base={base} />
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
