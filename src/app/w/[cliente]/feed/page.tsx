"use client";

import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
const SIZES = [340, 400, 470, 560, 680];
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
type Frame = { zoom: number; focusX: number; focusY: number };

/** Imagem ou primeiro quadro do vídeo, com o enquadramento escolhido. */
function Media({ url, video, frame, className = "size-full object-cover" }: { url: string | null; video: boolean; frame?: Frame; className?: string }) {
  if (!url) return null;
  const style = frame
    ? { objectPosition: `${frame.focusX}% ${frame.focusY}%`, transform: frame.zoom !== 1 ? `scale(${frame.zoom})` : undefined, transformOrigin: `${frame.focusX}% ${frame.focusY}%` }
    : undefined;
  return video ? (
    <video src={`${url}#t=0.1`} muted playsInline preload="metadata" draggable={false} className={className} style={style} />
  ) : (
    <img src={url} alt="" draggable={false} className={className} style={style} />
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
  const [size, setSize] = useState(2);

  if (data === undefined) return <Loading />;
  const { profile, posts, pieces, canManage, showPlanned } = data;
  const counted = pieces.length + posts.length;
  const current = open ? (posts.find((p) => p._id === open._id) ?? null) : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-16 pt-4 md:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="titulo text-5xl md:text-6xl">Feed</h1>
        <p className="text-base text-texto-2">
          {canManage ? "Use o + azul, cole o link do post ou aperte Ctrl+V com uma imagem copiada. Arraste os posts para mudar a ordem; toque num post para enquadrar, mudar o tipo ou tirar." : "Uma prévia de como o seu perfil vai ficar com os próximos posts."}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Toggle on={clean} onClick={() => setClean((c) => !c)}>Ver limpo, como no Instagram</Toggle>
        <span className="inline-flex items-center rounded-full border-[1.5px] border-campo bg-white" role="group" aria-label="Tamanho da prévia">
          <button type="button" onClick={() => setSize((n) => Math.max(0, n - 1))} disabled={size === 0} aria-label="Diminuir a prévia" className="flex size-10 items-center justify-center rounded-full text-lg font-bold disabled:opacity-30">−</button>
          <span className="px-1 text-sm font-semibold">Tamanho</span>
          <button type="button" onClick={() => setSize((n) => Math.min(SIZES.length - 1, n + 1))} disabled={size === SIZES.length - 1} aria-label="Aumentar a prévia" className="flex size-10 items-center justify-center rounded-full text-lg font-bold disabled:opacity-30">+</button>
        </span>
        {canManage && (
          <Toggle on={showPlanned} onClick={() => void setShowPlanned({ slug: ws.slug, value: !showPlanned })}>
            Mostrar peças do calendário
          </Toggle>
        )}
      </div>

      <section
        aria-label={`Prévia do perfil @${profile.handle}`}
        style={{ maxWidth: SIZES[size] }}
        className="mx-auto w-full overflow-hidden rounded-[28px] border border-[#DBDBDB] bg-white text-black shadow-[0_10px_40px_rgba(92,15,49,0.10)]">
        <ProfileHeader profile={profile} count={counted} canManage={canManage} onEdit={() => setEditing(true)} />

        {canManage && (
          <div className="flex items-start gap-2 border-t border-[#EFEFEF] px-3 py-2.5">
            <AddButtons slug={ws.slug} />
            <LinkBar slug={ws.slug} />
          </div>
        )}
        {counted > 0 && (
          <PostGrid
            slug={ws.slug}
            posts={posts}
            canManage={canManage}
            onOpen={setOpen}
            before={pieces.map((p) => (
              <PieceTile key={p._id} p={p} slug={ws.slug} clean={clean} accent={profile.accentColor} />
            ))}
          />
        )}
        {counted === 0 && (
          <p className="px-6 py-14 text-center text-[14px] text-[#737373]">
            {canManage ? "Toque no + azul, cole um link ou aperte Ctrl+V com uma imagem copiada." : "Ainda não tem posts na prévia."}
          </p>
        )}

        {canManage && <AddOlder slug={ws.slug} />}
      </section>

      {editing && <EditProfile slug={ws.slug} clientId={data.clientId} profile={profile} onClose={() => setEditing(false)} />}
      {current && <PostSheet post={current} index={posts.indexOf(current)} total={posts.length} canManage={canManage} onClose={() => setOpen(null)} />}
    </main>
  );
}

/** Grade de posts: arrasta para mudar a ordem (segura um instante no celular). */
function PostGrid({ slug, posts, canManage, onOpen, before }: { slug: string; posts: Post[]; canManage: boolean; onOpen: (p: Post) => void; before: ReactNode }) {
  const reorder = useMutation(api.feed.reorder);
  const [order, setOrder] = useState<Id<"feedPosts">[] | null>(null);
  const [active, setActive] = useState<Id<"feedPosts"> | null>(null);
  const serverIds = posts.map((p) => p._id);
  // A ordem arrastada vale até o servidor confirmar (ou mudar a lista).
  const ids = order && order.length === serverIds.length && order.every((id) => serverIds.includes(id)) ? order : serverIds;
  const byId = new Map(posts.map((p) => [p._id, p]));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const end = (e: DragEndEvent) => {
    setActive(null);
    if (!e.over || e.active.id === e.over.id) return;
    const from = ids.indexOf(e.active.id as Id<"feedPosts">);
    const to = ids.indexOf(e.over.id as Id<"feedPosts">);
    if (from < 0 || to < 0) return;
    const next = arrayMove(ids, from, to);
    setOrder(next);
    void reorder({ slug, ids: next }).catch(() => setOrder(null));
  };

  const dragged = active ? byId.get(active) : null;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActive(e.active.id as Id<"feedPosts">)}
      onDragCancel={() => setActive(null)}
      onDragEnd={end}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <ol className="grid grid-cols-3 gap-[2px]">
          {before}
          {ids.map((id) => {
            const p = byId.get(id);
            return p ? <SortablePost key={id} post={p} canManage={canManage} onOpen={onOpen} /> : null;
          })}
        </ol>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 160, easing: "ease-out" }}>
        {dragged ? (
          <div className="relative aspect-[3/4] w-full scale-105 overflow-hidden rounded-sm bg-[#EFEFEF] shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
            <Media url={dragged.url} video={dragged.isVideo} frame={dragged} />
            <KindIcon kind={dragged.kind} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortablePost({ post, canManage, onOpen }: { post: Post; canManage: boolean; onOpen: (p: Post) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: post._id, disabled: !canManage });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className={`relative aspect-[3/4] overflow-hidden bg-[#EFEFEF] ${canManage ? "cursor-grab touch-manipulation select-none active:cursor-grabbing" : ""}`}
      {...attributes}
      {...listeners}
      aria-roledescription={canManage ? "post arrastável" : undefined}
    >
      <button type="button" onClick={() => onOpen(post)} className="block size-full" aria-label={`Abrir ${KIND_LABEL[post.kind].toLowerCase()}`}>
        <Media url={post.url} video={post.isVideo} frame={post} />
        <KindIcon kind={post.kind} />
      </button>
    </li>
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

/** Botões "+" e "Colar": o próximo post entra no topo do feed. */
function AddButtons({ slug }: { slug: string }) {
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

  const choose = (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []).filter((f) => isImageFile(f) || isVideoFile(f));
    if (!files.length) return;
    // Várias fotos (sem vídeo): pergunta se é um carrossel ou posts separados.
    if (files.length > 1 && files.every(isImageFile)) setPicked(files);
    else void send(files, false);
  };

  // Ctrl+V em qualquer lugar da página: a imagem copiada entra no topo do feed.
  const chooseRef = useRef(choose);
  useEffect(() => {
    chooseRef.current = choose;
  });
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.closest("input, textarea, [contenteditable]") || target.closest("dialog"))) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (!files.length) {
        // Colou um link: o Hub busca a capa do post.
        const text = e.clipboardData?.getData("text")?.trim() ?? "";
        if (/^https?:\/\/\S+$/i.test(text)) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("feed-link", { detail: text }));
        }
        return;
      }
      e.preventDefault();
      chooseRef.current(files.map((f, i) => (f.name && f.name !== "image.png" ? f : new File([f], `colado-${Date.now()}-${i}.png`, { type: f.type || "image/png" }))));
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      chooseRef.current(e.dataTransfer.files);
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onDragOver);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragover", onDragOver);
    };
  }, []);

  /** Botão "Colar": lê a imagem copiada (o navegador pede permissão na primeira vez). */
  const pasteFromButton = async () => {
    setError(null);
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const [i, item] of items.entries()) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) files.push(new File([await item.getType(type)], `colado-${Date.now()}-${i}.${type.split("/")[1] || "png"}`, { type }));
      }
      if (files.length) choose(files);
      else setError("Não tem imagem copiada. Copie a imagem e tente de novo.");
    } catch {
      setError("O navegador não deixou colar por aqui. Use Ctrl+V na página.");
    }
  };

  return (
    <div className="relative flex shrink-0 items-center gap-1.5">
      <label
        title="Adicionar fotos ou vídeo no topo"
        className={`flex size-10 cursor-pointer items-center justify-center rounded-full bg-[#0095F6] text-white hover:bg-[#1877F2] ${progress ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="sr-only">Adicionar fotos ou vídeo</span>
        <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-[2.4]" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        <input ref={input} type="file" multiple accept="image/*,video/*" className="sr-only" onChange={(e) => choose(e.target.files)} />
      </label>
      <button
        type="button"
        onClick={() => void pasteFromButton()}
        disabled={!!progress}
        title="Colar a imagem copiada"
        className="min-h-10 rounded-full border border-[#DBDBDB] bg-white px-3 text-[13px] font-semibold hover:bg-[#FAFAFA] disabled:opacity-50"
      >
        {progress ? `Enviando ${progress}` : "Colar"}
      </button>
      {error && <span role="alert" className="absolute left-0 top-full z-10 mt-1 w-64 rounded-lg bg-white p-2 text-[12px] font-semibold text-st-ajuste-texto shadow-md">{error}</span>}
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
    </div>
  );
}

/** Cola o link de um post (Instagram, TikTok, YouTube, Drive, Canva...) e o Hub busca a capa. */
function LinkBar({ slug }: { slug: string }) {
  const addFromLink = useAction(api.feed.addFromLink);
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async (link: string) => {
    const clean = link.trim();
    if (!clean) return;
    setPending(true);
    setMsg(null);
    try {
      const { kind } = await addFromLink({ slug, url: clean });
      setUrl("");
      setMsg({ ok: true, text: kind === "reels" ? "Reels adicionado no topo." : "Post adicionado no topo." });
    } catch (err) {
      setUrl(clean);
      setMsg({ ok: false, text: errorText(err) });
    } finally {
      setPending(false);
    }
  };

  // Ctrl+V de um link em qualquer lugar da página chega aqui.
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  useEffect(() => {
    const onLink = (e: Event) => void sendRef.current((e as CustomEvent<string>).detail);
    window.addEventListener("feed-link", onLink);
    return () => window.removeEventListener("feed-link", onLink);
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send(url);
      }}
      className="flex min-w-0 flex-1 flex-col gap-1"
    >
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="feed-link">Link do post</label>
        <input
          id="feed-link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Ou cole o link do post"
          inputMode="url"
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#DBDBDB] bg-[#FAFAFA] px-3 text-[14px] text-black"
        />
        <button type="submit" disabled={pending || !url.trim()} className="min-h-10 shrink-0 rounded-lg bg-[#0095F6] px-4 text-[13px] font-semibold text-white disabled:opacity-40">
          {pending ? "Buscando" : "Adicionar"}
        </button>
      </div>
      {msg && (
        <span role={msg.ok ? "status" : "alert"} className={`text-[12px] font-semibold ${msg.ok ? "text-[#1F8F4E]" : "text-st-ajuste-texto"}`}>
          {msg.text}
        </span>
      )}
    </form>
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
          <FrameEditor key={post._id} post={post} />
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

/** Enquadrar na grade: arrasta a imagem e usa − e + para o zoom. Salva sozinho. */
function FrameEditor({ post }: { post: Post }) {
  const setFrame = useMutation(api.feed.setFrame);
  const [f, setF] = useState<Frame>({ zoom: post.zoom, focusX: post.focusX, focusY: post.focusY });
  const drag = useRef<{ x: number; y: number; start: Frame; w: number; h: number } | null>(null);
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  const save = (next: Frame) => {
    setF(next);
    void setFrame({ postId: post._id, ...next });
  };
  const zoomBy = (d: number) => save({ ...f, zoom: Math.round(clamp(f.zoom + d, 1, 3) * 100) / 100 });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">Enquadrar na grade</span>
      <div className="flex items-center gap-4">
        <div
          className="relative aspect-[3/4] w-32 shrink-0 cursor-move touch-none overflow-hidden rounded-md bg-[#EFEFEF] outline outline-2 outline-[#0095F6]"
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, start: f, w: r.width, h: r.height };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            // Arrastar para a direita mostra mais da esquerda (o foco anda ao contrário).
            const k = 120 / d.start.zoom;
            setF({
              ...d.start,
              focusX: clamp(d.start.focusX - ((e.clientX - d.x) / d.w) * k, 0, 100),
              focusY: clamp(d.start.focusY - ((e.clientY - d.y) / d.h) * k, 0, 100),
            });
          }}
          onPointerUp={() => {
            if (drag.current) save(f);
            drag.current = null;
          }}
          aria-label="Arraste para enquadrar a imagem"
        >
          <Media url={post.url} video={post.isVideo} frame={f} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2" role="group" aria-label="Zoom">
            <button type="button" onClick={() => zoomBy(-0.1)} disabled={f.zoom <= 1} aria-label="Menos zoom" className="flex size-11 items-center justify-center rounded-full bg-creme text-xl font-bold disabled:opacity-30">−</button>
            <span className="w-12 text-center text-sm font-semibold">{Math.round(f.zoom * 100)}%</span>
            <button type="button" onClick={() => zoomBy(0.1)} disabled={f.zoom >= 3} aria-label="Mais zoom" className="flex size-11 items-center justify-center rounded-full bg-creme text-xl font-bold disabled:opacity-30">+</button>
          </div>
          <button type="button" onClick={() => save({ zoom: 1, focusX: 50, focusY: 50 })} className="min-h-10 self-start text-sm font-semibold text-rosa-forte">
            Voltar ao original
          </button>
          <span className="text-xs text-texto-2">Arraste a imagem para escolher o recorte.</span>
        </div>
      </div>
    </div>
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
