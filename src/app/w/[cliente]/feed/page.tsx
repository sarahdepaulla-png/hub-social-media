"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRef, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Loading, buttonClass } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { useWorkspace } from "@/components/WorkspaceShell";
import { shortDate } from "@/lib/dates";
import { STATUS } from "@/lib/labels";

type Feed = FunctionReturnType<typeof api.feed.get>;
type Piece = Feed["pieces"][number];
type Post = Feed["posts"][number];
type Kind = "post" | "carrossel" | "reels";

const KIND_LABEL: Record<Kind, string> = { post: "Post", carrossel: "Carrossel", reels: "Reels" };

function pieceKind(format: Piece["format"]): Kind {
  if (format === "carrossel") return "carrossel";
  if (format === "reels" || format === "video") return "reels";
  return "post";
}

/** Ícones do canto do post, como no Instagram. */
function KindIcon({ kind }: { kind: Kind }) {
  if (kind === "post") return null;
  return (
    <span aria-label={KIND_LABEL[kind]} className="absolute right-1.5 top-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
      {kind === "carrossel" ? (
        <svg viewBox="0 0 24 24" className="size-[18px] fill-white" aria-hidden="true">
          <path d="M8 3h11a2 2 0 012 2v11a2 2 0 01-2 2h-1V7a2 2 0 00-2-2H6V5a2 2 0 012-2zM4 7h11a2 2 0 012 2v11a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-[18px] fill-white" aria-hidden="true">
          <path d="M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zm3 6v6l5-3-5-3z" />
        </svg>
      )}
    </span>
  );
}

function PieceTile({ p, slug, marks, accent }: { p: Piece; slug: string; marks: boolean; accent: string }) {
  const kind = pieceKind(p.format);
  const st = STATUS[p.status];
  const posted = p.status === "publicado";
  return (
    <li className="relative aspect-[3/4] overflow-hidden bg-[#EFEFEF]">
      <Link href={`/w/${slug}/c/${p._id}`} className="block size-full" aria-label={`${p.title}, ${shortDate(p.date)}, ${st.label}`}>
        {p.coverUrl ? (
          <img src={p.coverUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center p-3 text-center text-[13px] font-bold leading-tight text-white" style={{ background: accent }}>
            {p.title}
          </span>
        )}
        <KindIcon kind={kind} />
        {marks && !posted && (
          <span className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-vinho">
            <span>{shortDate(p.date)}</span>
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: st.color }} />
              <span className="truncate">{st.short}</span>
            </span>
          </span>
        )}
      </Link>
    </li>
  );
}

function PostTile({ p }: { p: Post }) {
  return (
    <li className="relative aspect-[3/4] overflow-hidden bg-[#EFEFEF]">
      {p.url && <img src={p.url} alt="" className="size-full object-cover" />}
      <KindIcon kind={p.kind} />
    </li>
  );
}

function Avatar({ url, name, accent }: { url: string | null; name: string; accent: string }) {
  return (
    <span className="shrink-0 rounded-full bg-[conic-gradient(from_200deg,#FCAF45,#F77737,#E1306C,#C13584,#833AB4,#FCAF45)] p-[3px]">
      <span className="block rounded-full bg-white p-[3px]">
        {url ? (
          <img src={url} alt="" className="size-[76px] rounded-full object-cover md:size-[110px]" />
        ) : (
          <span className="flex size-[76px] items-center justify-center rounded-full text-2xl font-bold text-white md:size-[110px]" style={{ background: accent }}>
            {name.charAt(0)}
          </span>
        )}
      </span>
    </span>
  );
}

export default function FeedPage() {
  const ws = useWorkspace();
  const data = useQuery(api.feed.get, { slug: ws.slug });
  const [marks, setMarks] = useState(true);
  const [onlyApproved, setOnlyApproved] = useState(false);

  if (data === undefined) return <Loading />;
  const { client, posts, canManage } = data;
  const pieces = onlyApproved ? data.pieces.filter((p) => ["aprovado", "agendado", "publicado"].includes(p.status)) : data.pieces;
  const total = pieces.length + posts.length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-4 md:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="titulo text-5xl md:text-6xl">Feed</h1>
        <p className="text-base text-texto-2">
          Como o perfil vai ficar. As peças planejadas aparecem em cima, na ordem das datas{posts.length ? ", e embaixo os posts que já estão no ar" : ""}.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={!marks}
          onClick={() => setMarks((m) => !m)}
          className={`min-h-10 rounded-full border-[1.5px] px-4 text-sm font-semibold ${!marks ? "border-vinho bg-vinho text-white" : "border-campo bg-white"}`}
        >
          Ver limpo, como no Instagram
        </button>
        <button
          type="button"
          aria-pressed={onlyApproved}
          onClick={() => setOnlyApproved((o) => !o)}
          className={`min-h-10 rounded-full border-[1.5px] px-4 text-sm font-semibold ${onlyApproved ? "border-vinho bg-vinho text-white" : "border-campo bg-white"}`}
        >
          Só aprovadas
        </button>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[470px_minmax(0,1fr)]">
        {/* O "celular": perfil do Instagram */}
        <section aria-label={`Prévia do perfil @${client.handle}`} className="mx-auto w-full max-w-[470px] overflow-hidden rounded-[28px] border border-[#DBDBDB] bg-white font-sans text-[#000] shadow-[0_10px_40px_rgba(92,15,49,0.10)]">
          <div className="flex items-center justify-center gap-1 border-b border-[#EFEFEF] px-4 py-3 text-[16px] font-bold">
            {client.handle}
          </div>
          <div className="flex items-center gap-5 px-4 pt-4 md:gap-8">
            <Avatar url={client.photoUrl} name={client.name} accent={client.accentColor} />
            <dl className="grid flex-1 grid-cols-3 text-center text-[13px]">
              <div className="flex flex-col-reverse">
                <dt>posts</dt>
                <dd className="text-[16px] font-bold">{total}</dd>
              </div>
              <div className="flex flex-col-reverse">
                <dt>seguidores</dt>
                <dd className="text-[16px] font-bold">·</dd>
              </div>
              <div className="flex flex-col-reverse">
                <dt>seguindo</dt>
                <dd className="text-[16px] font-bold">·</dd>
              </div>
            </dl>
          </div>
          <div className="px-4 pb-3 pt-3 text-[14px] leading-snug">
            <strong className="block">{client.name}</strong>
            {client.description && <p className="whitespace-pre-wrap">{client.description}</p>}
          </div>
          <div className="grid grid-cols-2 gap-1.5 px-4 pb-3">
            <span className="rounded-lg bg-[#EFEFEF] py-1.5 text-center text-[13px] font-semibold">Seguir</span>
            <span className="rounded-lg bg-[#EFEFEF] py-1.5 text-center text-[13px] font-semibold">Mensagem</span>
          </div>
          <div className="flex border-t border-[#DBDBDB]" aria-hidden="true">
            <span className="flex flex-1 justify-center border-t border-black py-2.5">
              <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-black stroke-2"><path d="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18" /></svg>
            </span>
            <span className="flex flex-1 justify-center py-2.5 opacity-40">
              <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-black stroke-2"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M10 9l5 3-5 3z" /></svg>
            </span>
            <span className="flex flex-1 justify-center py-2.5 opacity-40">
              <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-black stroke-2"><path d="M4 20c1-4 4-6 8-6s7 2 8 6M12 11a4 4 0 100-8 4 4 0 000 8z" /></svg>
            </span>
          </div>
          {total === 0 ? (
            <p className="px-6 py-14 text-center text-[14px] text-[#737373]">Ainda não tem nada para mostrar.</p>
          ) : (
            <ol className="grid grid-cols-3 gap-[2px]">
              {pieces.map((p) => (
                <PieceTile key={p._id} p={p} slug={ws.slug} marks={marks} accent={client.accentColor} />
              ))}
              {posts.map((p) => (
                <PostTile key={p._id} p={p} />
              ))}
            </ol>
          )}
        </section>

        {canManage && <Manage slug={ws.slug} handle={client.handle} posts={posts} />}
      </div>
    </main>
  );
}

/** Só a admin: @ do perfil e prints dos posts que já estão no ar. */
function Manage({ slug, handle, posts }: { slug: string; handle: string; posts: Post[] }) {
  const uploadUrl = useMutation(api.feed.generateUploadUrl);
  const addPosts = useMutation(api.feed.addPosts);
  const movePost = useMutation(api.feed.movePost);
  const setKind = useMutation(api.feed.setKind);
  const removePost = useMutation(api.feed.removePost);
  const setHandle = useMutation(api.feed.setHandle);
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const upload = async (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    if (!list.length) return;
    setError(null);
    const ids: Id<"_storage">[] = [];
    try {
      for (const [i, f] of list.entries()) {
        setProgress(`Enviando ${i + 1} de ${list.length}`);
        const res = await fetch(await uploadUrl(), { method: "POST", headers: { "Content-Type": f.type || "image/jpeg" }, body: f });
        if (!res.ok) throw new Error(`Falha no envio (${res.status})`);
        ids.push(((await res.json()) as { storageId: Id<"_storage"> }).storageId);
      }
      await addPosts({ slug, storageIds: ids });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  };

  const saveHandle = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await setHandle({ slug, handle: String(new FormData(e.currentTarget).get("handle") ?? "") });
      setSaved(true);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const act = (fn: () => Promise<unknown>) => fn().catch((err) => setError(errorText(err)));

  return (
    <section aria-label="Montar a prévia" className="flex min-w-0 flex-col gap-6 rounded-peca bg-white p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[22px] font-extrabold tracking-[-0.04em]">Montar a prévia</h2>
        <p className="text-sm text-texto-2">Só você vê esta parte. A cliente vê só o feed.</p>
      </div>

      <form onSubmit={saveHandle} onChange={() => setSaved(false)} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold">
          @ do Instagram
          <input name="handle" defaultValue={handle} placeholder="liliexplica" className="min-h-11 w-full border-[1.5px] border-campo bg-white px-3 text-base font-normal" />
        </label>
        <button type="submit" className={`${buttonClass.outline} min-h-11 px-5 text-sm`}>{saved ? "Salvo" : "Salvar"}</button>
      </form>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold">Posts que já estão no ar</h3>
          <p className="text-sm text-texto-2">
            Tire print dos últimos 9 a 12 posts do perfil e suba todos de uma vez, do mais recente para o mais antigo. Eles ficam embaixo das peças planejadas.
            Quando uma peça é marcada como publicada no Hub, ela já entra no feed sozinha.
          </p>
        </div>
        <label className={`${buttonClass.secondary} min-h-11 cursor-pointer self-start px-5 text-sm`}>
          {progress ?? (posts.length ? "Adicionar mais prints" : "Escolher prints")}
          <input ref={input} type="file" multiple accept="image/*" className="sr-only" disabled={!!progress} onChange={(e) => void upload(e.target.files)} />
        </label>
        {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}

        {posts.length > 0 && (
          <ol className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {posts.map((p, i) => (
              <li key={p._id} className="flex min-w-0 flex-col gap-1.5">
                <span className="relative block aspect-[3/4] overflow-hidden rounded-lg bg-thumb">
                  {p.url && <img src={p.url} alt="" className="size-full object-cover" />}
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-vinho px-2 text-xs font-bold leading-5 text-white">{i + 1}</span>
                </span>
                <label className="sr-only" htmlFor={`tipo-${p._id}`}>Tipo do post {i + 1}</label>
                <select
                  id={`tipo-${p._id}`}
                  value={p.kind}
                  onChange={(e) => act(() => setKind({ postId: p._id, kind: e.target.value as Kind }))}
                  className="min-h-9 w-full border border-campo bg-white px-1.5 text-[13px]"
                >
                  {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                    <option key={k} value={k}>{KIND_LABEL[k]}</option>
                  ))}
                </select>
                <span className="flex items-center justify-between">
                  <button type="button" aria-label={`Mover post ${i + 1} para antes`} disabled={i === 0} onClick={() => act(() => movePost({ postId: p._id, direction: -1 }))} className="size-9 rounded-full text-lg disabled:opacity-25">‹</button>
                  <button
                    type="button"
                    aria-label={`Tirar post ${i + 1}`}
                    onClick={() => window.confirm("Tirar este print da prévia?") && act(() => removePost({ postId: p._id }))}
                    className="min-h-9 px-1 text-xs font-semibold text-st-ajuste-texto"
                  >
                    Tirar
                  </button>
                  <button type="button" aria-label={`Mover post ${i + 1} para depois`} disabled={i === posts.length - 1} onClick={() => act(() => movePost({ postId: p._id, direction: 1 }))} className="size-9 rounded-full text-lg disabled:opacity-25">›</button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
