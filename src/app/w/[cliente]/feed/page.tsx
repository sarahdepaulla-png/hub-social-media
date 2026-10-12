"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Loading, buttonClass } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { useWorkspace } from "@/components/WorkspaceShell";
import { shortDate } from "@/lib/dates";
import { STATUS, type Status } from "@/lib/labels";

type Feed = FunctionReturnType<typeof api.feed.get>;
type Piece = Feed["pieces"][number];
type Post = Feed["posts"][number];
type Profile = Feed["profile"];
type Kind = "post" | "carrossel" | "reels";

const KIND_LABEL: Record<Kind, string> = { post: "Post", carrossel: "Carrossel", reels: "Reels" };
const isVideoFile = (f: File) => f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm)$/i.test(f.name);
const isImageFile = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name);

function pieceKind(format: string): Kind {
  if (format === "carrossel") return "carrossel";
  if (format === "reels" || format === "video") return "reels";
  return "post";
}

/** Ícones do canto do post, como no Instagram. */
function KindIcon({ kind }: { kind: Kind }) {
  if (kind === "post") return null;
  return (
    <span aria-label={KIND_LABEL[kind]} className="pointer-events-none absolute right-1.5 top-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
      {kind === "carrossel" ? (
        <svg viewBox="0 0 24 24" className="size-[18px] fill-white" aria-hidden="true">
          <path d="M8 3h11a2 2 0 012 2v11a2 2 0 01-2 2h-1V7a2 2 0 00-2-2H6V5a2 2 0 012-2zM4 7h11a2 2 0 012 2v11a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-[19px]" aria-hidden="true">
          <rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="none" stroke="white" strokeWidth="2" />
          <path d="M2.5 8h19M8.5 2.8l3 5.2M14.5 2.8l3 5.2" stroke="white" strokeWidth="2" fill="none" />
          <path d="M10 11.2v6l5-3z" fill="white" />
        </svg>
      )}
    </span>
  );
}

/** Imagem ou primeiro quadro do vídeo. */
function Media({ url, video, className = "size-full object-cover" }: { url: string | null; video: boolean; className?: string }) {
  if (!url) return null;
  return video ? (
    <video src={`${url}#t=0.1`} muted playsInline preload="metadata" className={className} />
  ) : (
    <img src={url} alt="" className={className} />
  );
}

/** Painel que abre por cima da página (perfil, post, carrossel). */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-label={title}
      className="m-auto max-h-[92dvh] w-[calc(100%-24px)] max-w-[480px] overflow-y-auto rounded-[22px] bg-white p-0 text-vinho backdrop:bg-vinho/45"
    >
      <div className="flex items-center justify-between border-b border-linha px-5 py-3">
        <strong className="text-base">{title}</strong>
        <button type="button" onClick={() => ref.current?.close()} aria-label="Fechar" className="flex size-11 items-center justify-center rounded-full text-2xl hover:bg-creme">
          ×
        </button>
      </div>
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </dialog>
  );
}

export default function FeedPage() {
  const ws = useWorkspace();
  const data = useQuery(api.feed.get, { slug: ws.slug });
  const setShowPlanned = useMutation(api.feed.setShowPlanned);
  const [clean, setClean] = useState(false);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<Post | null>(null);

  if (data === undefined) return <Loading />;
  const { profile, posts, pieces, canManage, showPlanned } = data;
  const counted = pieces.length + posts.length;
  const current = open ? (posts.find((p) => p._id === open._id) ?? null) : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-16 pt-4 md:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="titulo text-5xl md:text-6xl">Feed</h1>
        <p className="text-base text-texto-2">
          {canManage ? "Toque no + para colocar o próximo post e veja como fica o perfil. Toque num post para mudar o tipo, a ordem ou tirar." : "Uma prévia de como o seu perfil vai ficar com os próximos posts."}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Toggle on={clean} onClick={() => setClean((c) => !c)}>Ver limpo, como no Instagram</Toggle>
        {canManage && (
          <Toggle on={showPlanned} onClick={() => void setShowPlanned({ slug: ws.slug, value: !showPlanned })}>
            Mostrar peças do calendário
          </Toggle>
        )}
      </div>

      <section aria-label={`Prévia do perfil @${profile.handle}`} className="mx-auto w-full max-w-[470px] overflow-hidden rounded-[28px] border border-[#DBDBDB] bg-white text-black shadow-[0_10px_40px_rgba(92,15,49,0.10)]">
        <ProfileHeader profile={profile} count={counted} canManage={canManage} onEdit={() => setEditing(true)} />

        <ol className="grid grid-cols-3 gap-[2px]">
          {canManage && <AddTile slug={ws.slug} />}
          {pieces.map((p) => (
            <PieceTile key={p._id} p={p} slug={ws.slug} clean={clean} accent={profile.accentColor} />
          ))}
          {posts.map((p) => (
            <li key={p._id} className="relative aspect-[3/4] overflow-hidden bg-[#EFEFEF]">
              <button type="button" onClick={() => setOpen(p)} className="block size-full" aria-label={`Abrir ${KIND_LABEL[p.kind].toLowerCase()}`}>
                <Media url={p.url} video={p.isVideo} />
                <KindIcon kind={p.kind} />
              </button>
            </li>
          ))}
          {!canManage && counted === 0 && <li className="col-span-3 px-6 py-14 text-center text-[14px] text-[#737373]">Ainda não tem posts na prévia.</li>}
        </ol>

        {canManage && <AddOlder slug={ws.slug} />}
      </section>

      {editing && <EditProfile slug={ws.slug} clientId={data.clientId} profile={profile} onClose={() => setEditing(false)} />}
      {current && <PostSheet post={current} index={posts.indexOf(current)} total={posts.length} canManage={canManage} onClose={() => setOpen(null)} />}
    </main>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-10 rounded-full border-[1.5px] px-4 text-sm font-semibold ${on ? "border-vinho bg-vinho text-white" : "border-campo bg-white text-vinho"}`}
    >
      {children}
    </button>
  );
}

function ProfileHeader({ profile, count, canManage, onEdit }: { profile: Profile; count: number; canManage: boolean; onEdit: () => void }) {
  const stats = [
    { label: "posts", value: profile.posts || String(count) },
    { label: "seguidores", value: profile.followers || "0" },
    { label: "seguindo", value: profile.following || "0" },
  ];
  return (
    <>
      <div className="flex items-center justify-center border-b border-[#EFEFEF] px-4 py-3 text-[16px] font-bold">{profile.handle}</div>
      <div className="flex items-center gap-5 px-4 pt-4 md:gap-7">
        <button type="button" onClick={canManage ? onEdit : undefined} disabled={!canManage} aria-label={canManage ? "Editar perfil" : undefined} className="shrink-0 rounded-full disabled:cursor-default">
          <span className="block rounded-full bg-[conic-gradient(from_200deg,#FCAF45,#F77737,#E1306C,#C13584,#833AB4,#FCAF45)] p-[3px]">
            <span className="block rounded-full bg-white p-[3px]">
              {profile.photoUrl ? (
                <img src={profile.photoUrl} alt="" className="size-[78px] rounded-full object-cover" />
              ) : (
                <span className="flex size-[78px] items-center justify-center rounded-full text-2xl font-bold text-white" style={{ background: profile.accentColor }}>
                  {profile.name.charAt(0)}
                </span>
              )}
            </span>
          </span>
        </button>
        <dl className="grid flex-1 grid-cols-3 text-center text-[13px]">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse">
              <dt>{s.label}</dt>
              <dd className="text-[16px] font-bold">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="px-4 pb-3 pt-3 text-[14px] leading-snug">
        <strong className="block">{profile.name}</strong>
        {profile.bio && <p className="whitespace-pre-wrap">{profile.bio}</p>}
        {profile.link && <span className="block truncate font-semibold text-[#00376B]">{profile.link.replace(/^https?:\/\//, "")}</span>}
      </div>
      <div className="grid grid-cols-2 gap-1.5 px-4 pb-3">
        {canManage ? (
          <>
            <button type="button" onClick={onEdit} className="rounded-lg bg-[#EFEFEF] py-2 text-center text-[13px] font-semibold hover:bg-[#DBDBDB]">
              Editar perfil
            </button>
            <span className="rounded-lg bg-[#EFEFEF] py-2 text-center text-[13px] font-semibold">Compartilhar perfil</span>
          </>
        ) : (
          <>
            <span className="rounded-lg bg-[#0095F6] py-2 text-center text-[13px] font-semibold text-white">Seguir</span>
            <span className="rounded-lg bg-[#EFEFEF] py-2 text-center text-[13px] font-semibold">Mensagem</span>
          </>
        )}
      </div>
      <div className="flex border-t border-[#DBDBDB]" aria-hidden="true">
        <span className="flex flex-1 justify-center border-t border-black py-2.5">
          <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-black stroke-2"><path d="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18" /></svg>
        </span>
        <span className="flex flex-1 justify-center py-2.5 opacity-40">
          <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-black stroke-2"><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M3 8h18M9 3l3 5M15 3l3 5" /><path d="M10 11v6l5-3z" className="fill-black" /></svg>
        </span>
        <span className="flex flex-1 justify-center py-2.5 opacity-40">
          <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-black stroke-2"><path d="M4 20c1-4 4-6 8-6s7 2 8 6M12 11a4 4 0 100-8 4 4 0 000 8z" /></svg>
        </span>
      </div>
    </>
  );
}

/** Sobe os arquivos e devolve os ids, na ordem escolhida. */
function useUpload() {
  const uploadUrl = useMutation(api.feed.generateUploadUrl);
  return async (files: File[], onStep?: (i: number) => void) => {
    const ids: Id<"_storage">[] = [];
    for (const [i, f] of files.entries()) {
      onStep?.(i);
      if (f.size > 100 * 1024 * 1024) throw new Error(`${f.name} passa de 100 MB.`);
      const res = await fetch(await uploadUrl(), { method: "POST", headers: { "Content-Type": f.type || "application/octet-stream" }, body: f });
      if (!res.ok) throw new Error(`Falha no envio (${res.status})`);
      ids.push(((await res.json()) as { storageId: Id<"_storage"> }).storageId);
    }
    return ids;
  };
}

/** O "+" do começo da grade: o próximo post entra no topo do feed. */
function AddTile({ slug }: { slug: string }) {
  const addPosts = useMutation(api.feed.addPosts);
  const upload = useUpload();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File[] | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (files: File[], asCarousel: boolean) => {
    setPicked(null);
    setError(null);
    try {
      const ids = await upload(files, (i) => setProgress(`${i + 1}/${files.length}`));
      const items = asCarousel
        ? [{ storageIds: ids, isVideo: false }]
        : files.map((f, i) => ({ storageIds: [ids[i]], isVideo: isVideoFile(f) }));
      // O primeiro escolhido fica no topo: o feed é do mais novo para o mais antigo.
      await addPosts({ slug, where: "topo", items });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  };

  const choose = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => isImageFile(f) || isVideoFile(f));
    if (!files.length) return;
    // Várias fotos (sem vídeo): pergunta se é um carrossel ou posts separados.
    if (files.length > 1 && files.every(isImageFile)) setPicked(files);
    else void send(files, false);
  };

  return (
    <li className="relative aspect-[3/4]">
      <label className={`flex size-full cursor-pointer flex-col items-center justify-center gap-1.5 border-2 border-dashed border-[#C7C7C7] bg-[#FAFAFA] text-[#737373] hover:border-[#0095F6] hover:text-[#0095F6] ${progress ? "pointer-events-none" : ""}`}>
        {progress ? (
          <span className="text-[13px] font-semibold">Enviando {progress}</span>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="size-9 fill-none stroke-current stroke-[1.6]" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 7.5v9M7.5 12h9" />
            </svg>
            <span className="text-[13px] font-semibold">Adicionar</span>
          </>
        )}
        <input ref={input} type="file" multiple accept="image/*,video/*" className="sr-only" onChange={(e) => choose(e.target.files)} />
      </label>
      {error && <span role="alert" className="absolute inset-x-1 bottom-1 rounded bg-white/95 p-1 text-[11px] font-semibold text-st-ajuste-texto">{error}</span>}
      {picked && (
        <Sheet title={`${picked.length} fotos escolhidas`} onClose={() => setPicked(null)}>
          <p className="text-[15px]">Como elas entram no feed?</p>
          <button type="button" onClick={() => void send(picked, true)} className={buttonClass.primary}>
            Um carrossel com {picked.length} fotos
          </button>
          <button type="button" onClick={() => void send(picked, false)} className={buttonClass.outline}>
            {picked.length} posts separados
          </button>
        </Sheet>
      )}
    </li>
  );
}

/** Posts antigos (prints do perfil) entram no fim da grade. */
function AddOlder({ slug }: { slug: string }) {
  const addPosts = useMutation(api.feed.addPosts);
  const upload = useUpload();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => isImageFile(f) || isVideoFile(f));
    if (!files.length) return;
    setError(null);
    try {
      const ids = await upload(files, (i) => setProgress(`Enviando ${i + 1} de ${files.length}`));
      await addPosts({ slug, where: "fim", items: files.map((f, i) => ({ storageIds: [ids[i]], isVideo: isVideoFile(f) })) });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-center gap-1 border-t border-[#EFEFEF] px-4 py-4 text-center">
      <label className="min-h-11 cursor-pointer content-center text-[13px] font-semibold text-[#0095F6]">
        {progress ?? "Adicionar posts antigos no fim do feed"}
        <input ref={input} type="file" multiple accept="image/*,video/*" className="sr-only" disabled={!!progress} onChange={(e) => void send(e.target.files)} />
      </label>
      <span className="text-[12px] text-[#737373]">Prints do perfil atual, do mais recente para o mais antigo.</span>
      {error && <span role="alert" className="text-[12px] font-semibold text-st-ajuste-texto">{error}</span>}
    </div>
  );
}

function PieceTile({ p, slug, clean, accent }: { p: Piece; slug: string; clean: boolean; accent: string }) {
  const st = STATUS[p.status as Status];
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
        <KindIcon kind={pieceKind(p.format)} />
        {!clean && (
          <span className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-vinho">
            <span>{shortDate(p.date)}</span>
            <span className="inline-flex min-w-0 items-center gap-1">
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: st.color }} />
              <span className="truncate">{st.short}</span>
            </span>
          </span>
        )}
      </Link>
    </li>
  );
}

/** Post aberto: ver em tamanho grande e, para a admin, mudar tipo, ordem ou tirar. */
function PostSheet({ post, index, total, canManage, onClose }: { post: Post; index: number; total: number; canManage: boolean; onClose: () => void }) {
  const setKind = useMutation(api.feed.setKind);
  const movePost = useMutation(api.feed.movePost);
  const removePost = useMutation(api.feed.removePost);
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) => fn().catch((err) => setError(errorText(err)));
  const cards = [post.url, ...post.extras].filter((u): u is string => !!u);

  return (
    <Sheet title={canManage ? `Post ${index + 1} de ${total}` : KIND_LABEL[post.kind]} onClose={onClose}>
      <div className="-mx-5 flex snap-x snap-mandatory gap-1 overflow-x-auto">
        {cards.map((u, i) => (
          <div key={u} className="relative aspect-[4/5] w-full shrink-0 snap-center bg-black">
            {post.isVideo ? (
              <video src={u} controls playsInline className="size-full object-contain" />
            ) : (
              <img src={u} alt={`Card ${i + 1}`} className="size-full object-contain" />
            )}
            {cards.length > 1 && <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 text-xs font-semibold leading-6 text-white">{i + 1}/{cards.length}</span>}
          </div>
        ))}
      </div>
      {cards.length > 1 && <p className="text-center text-xs text-texto-2">Arraste para o lado para ver os outros cards.</p>}

      {canManage && (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Tipo</span>
            <div role="radiogroup" aria-label="Tipo do post" className="grid grid-cols-3 gap-2">
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={post.kind === k}
                  onClick={() => run(() => setKind({ postId: post._id, kind: k }))}
                  className={`min-h-11 rounded-full text-sm font-semibold ${post.kind === k ? "bg-vinho text-white" : "bg-creme text-vinho"}`}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={index === 0} onClick={() => run(() => movePost({ postId: post._id, direction: -1 }))} className={`${buttonClass.outline} min-h-11 px-3 text-sm`}>
              ← Mais para cima
            </button>
            <button type="button" disabled={index === total - 1} onClick={() => run(() => movePost({ postId: post._id, direction: 1 }))} className={`${buttonClass.outline} min-h-11 px-3 text-sm`}>
              Mais para baixo →
            </button>
          </div>
          <button
            type="button"
            onClick={() => window.confirm("Tirar este post da prévia?") && run(async () => { await removePost({ postId: post._id }); onClose(); })}
            className={`${buttonClass.danger} min-h-11 text-sm`}
          >
            Tirar do feed
          </button>
          {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
        </>
      )}
    </Sheet>
  );
}

/** "Editar perfil", como no Instagram: foto, @, nome, bio, link e os números. */
function EditProfile({ slug, clientId, profile, onClose }: { slug: string; clientId: Id<"clients">; profile: Profile; onClose: () => void }) {
  const update = useMutation(api.feed.updateProfile);
  const setImage = useMutation(api.clients.setImage);
  const upload = useUpload();
  const [pending, setPending] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const field = "min-h-11 w-full border-[1.5px] border-campo bg-white px-3 text-base font-normal";

  const changePhoto = async (f: File | undefined) => {
    if (!f) return;
    setPhoto("Enviando");
    try {
      const [id] = await upload([f]);
      await setImage({ clientId, kind: "foto", storageId: id });
      setPhoto(null);
    } catch (err) {
      setError(errorText(err));
      setPhoto(null);
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const s = (k: string) => String(d.get(k) ?? "");
    setPending(true);
    setError(null);
    try {
      await update({ slug, handle: s("handle"), name: s("name"), bio: s("bio"), link: s("link"), posts: s("posts"), followers: s("followers"), following: s("following") });
      onClose();
    } catch (err) {
      setError(errorText(err));
      setPending(false);
    }
  };

  return (
    <Sheet title="Editar perfil" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          {profile.photoUrl ? (
            <img src={profile.photoUrl} alt="" className="size-16 rounded-full object-cover" />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-full text-xl font-bold text-white" style={{ background: profile.accentColor }}>{profile.name.charAt(0)}</span>
          )}
          <label className="min-h-11 cursor-pointer content-center text-sm font-semibold text-[#0095F6]">
            {photo ?? "Trocar foto do perfil"}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => void changePhoto(e.target.files?.[0])} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Nome de usuário
          <span className="flex items-center">
            <span className="flex min-h-11 items-center border-[1.5px] border-r-0 border-campo bg-creme px-2.5 text-base font-normal">@</span>
            <input name="handle" defaultValue={profile.handle} autoCapitalize="none" className={field} />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Nome
          <input name="name" defaultValue={profile.name} maxLength={60} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Bio
          <textarea name="bio" defaultValue={profile.bio} maxLength={300} rows={4} className={`${field} py-2.5 leading-snug`} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Link na bio
          <input name="link" defaultValue={profile.link} placeholder="linktr.ee/..." className={field} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Posts
            <input name="posts" defaultValue={profile.posts} placeholder="Automático" className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Seguidores
            <input name="followers" defaultValue={profile.followers} placeholder="12,3 mil" className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Seguindo
            <input name="following" defaultValue={profile.following} placeholder="512" className={field} />
          </label>
        </div>
        <p className="text-xs text-texto-2">Posts em branco conta sozinho os posts da prévia.</p>
        {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
        <button type="submit" disabled={pending} className={buttonClass.primary}>{pending ? "Salvando" : "Salvar"}</button>
      </form>
    </Sheet>
  );
}
