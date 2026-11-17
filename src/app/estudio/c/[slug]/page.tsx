"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Avatar, Loading, StatusTag, Thumb, buttonClass } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { monthName, shortDate, stamp, todayISO } from "@/lib/dates";
import { FORMAT } from "@/lib/labels";

type Panel = FunctionReturnType<typeof api.panel.get>;
type Profile = FunctionReturnType<typeof api.profile.get>;
type Item = Profile["items"][number];

const FOLDER_HINT: Record<string, string> = {
  "Recebidos da cliente": "Tudo o que a cliente mandou por WhatsApp, e-mail ou Drive.",
  "Drive e arquivos": "Links do Drive e materiais de trabalho.",
  "Fotos e vídeos": "Fotos e vídeos brutos para os posts.",
  Marca: "Logo, paleta, fontes, manual da marca.",
  "Acessos e senhas": "Instagram, Meta, Canva. Só você vê.",
  Anotações: "Tom de voz, combinados, o que evitar.",
};

const PLAN_STATUS = {
  rascunho: "Rascunho, só você vê",
  aguardando: "Esperando a cliente",
  aprovado: "Aprovado",
  ajuste: "Cliente pediu ajuste",
} as const;

const box = "flex flex-col gap-4 rounded-[22px] bg-white p-5 md:p-6";
const h2 = "text-xl font-extrabold tracking-[-0.04em]";
const small = "min-h-9 rounded-full px-3 text-sm font-semibold text-rosa-forte hover:bg-creme";
const field = "min-h-11 w-full rounded-lg border-[1.5px] border-campo bg-white px-3 text-base font-normal text-vinho";

function ago(ts: number) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return stamp(ts);
}

/* ---------- Ícones ---------- */

function FolderIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 40" className="h-10 w-12 shrink-0" aria-hidden="true">
      <path d="M2 6a4 4 0 014-4h12l5 5h19a4 4 0 014 4v23a4 4 0 01-4 4H6a4 4 0 01-4-4z" fill={color} opacity="0.9" />
      <path d="M2 13h44v21a4 4 0 01-4 4H6a4 4 0 01-4-4z" fill={color} />
    </svg>
  );
}

function FileGlyph({ kind, type }: { kind: Item["kind"]; type?: string }) {
  const label = kind === "link" ? "LINK" : kind === "nota" ? "NOTA" : kind === "acesso" ? "SENHA" : type?.startsWith("video/") ? "VÍDEO" : type?.includes("pdf") ? "PDF" : "ARQUIVO";
  return (
    <span className="flex size-full items-center justify-center bg-creme text-xs font-extrabold tracking-wider text-rosa-forte">{label}</span>
  );
}

/* ---------- Visão macro ---------- */

function Stat({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-creme px-4 py-3">
      <span className="text-3xl font-extrabold tracking-tight" style={tone && n > 0 ? { color: tone } : undefined}>
        {n}
      </span>
      <span className="text-[13px] leading-tight text-texto-3">{label}</span>
    </div>
  );
}

function PieceRow({ c, base, note }: { c: Panel["upcoming"][number]; base: string; note?: string }) {
  return (
    <li>
      <Link href={`${base}/c/${c._id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-creme">
        <Thumb url={c.coverUrl} className="h-14 w-11 shrink-0 rounded-lg" />
        <span className="flex min-w-0 flex-1 flex-col">
          <strong className="truncate text-[15px]">{c.title}</strong>
          <span className="text-[13px] text-texto-2">
            {shortDate(c.date)} · {FORMAT[c.format]}
            {note ? ` · ${note}` : ""}
          </span>
        </span>
        <StatusTag status={c.status} short className="shrink-0" />
      </Link>
    </li>
  );
}

/* ---------- Pastas ---------- */

async function uploadAll(files: File[], getUrl: () => Promise<string>) {
  const out: { id: Id<"_storage">; name: string; type: string }[] = [];
  for (const f of files) {
    const url = await getUrl();
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": f.type || "application/octet-stream" }, body: f });
    if (!res.ok) throw new Error(`Não subiu ${f.name}.`);
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    out.push({ id: storageId, name: f.name, type: f.type || "application/octet-stream" });
  }
  return out;
}

function ItemCard({ item, folders }: { item: Item; folders: string[] }) {
  const move = useMutation(api.profile.moveItem);
  const remove = useMutation(api.profile.remove);
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const isImg = item.file?.type.startsWith("image/");
  const href = item.file?.url ?? item.url ?? null;

  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sem permissão */
    }
  };

  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-linha bg-white">
      <a href={href ?? undefined} target="_blank" rel="noreferrer" className={`block aspect-[4/3] overflow-hidden ${href ? "" : "pointer-events-none"}`}>
        {isImg && item.file?.url ? <img src={item.file.url} alt="" className="size-full object-cover" /> : <FileGlyph kind={item.kind} type={item.file?.type} />}
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <strong className="line-clamp-2 break-words text-sm leading-snug">{item.title}</strong>
        {item.kind === "nota" && item.note && <p className="line-clamp-4 whitespace-pre-wrap text-[13px] text-texto-3">{item.note}</p>}
        {item.kind === "acesso" && (
          <div className="flex flex-col gap-1 text-[13px]">
            {item.login && <span className="truncate">{item.login}</span>}
            {item.secret && (
              <span className="flex items-center gap-2">
                <span className="font-mono">{show ? item.secret : "••••••••"}</span>
                <button type="button" onClick={() => setShow((s) => !s)} className="font-semibold text-rosa-forte">
                  {show ? "Esconder" : "Ver"}
                </button>
                <button type="button" onClick={() => void copy(item.secret!)} className="font-semibold text-rosa-forte">
                  {copied ? "Copiada" : "Copiar"}
                </button>
              </span>
            )}
          </div>
        )}
        <span className="text-xs text-texto-2">{stamp(item.updatedAt)}</span>
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
          {item.file?.url && (
            <a href={item.file.url} download={item.file.name} className="min-h-8 content-center rounded-full px-2 text-xs font-semibold text-rosa-forte hover:bg-creme">
              Baixar
            </a>
          )}
          <label className="sr-only" htmlFor={`mv-${item._id}`}>
            Mover para
          </label>
          <select
            id={`mv-${item._id}`}
            value=""
            onChange={(e) => e.target.value && void move({ itemId: item._id, folder: e.target.value })}
            className="min-h-8 max-w-[110px] rounded-full bg-creme px-2 text-xs font-semibold"
          >
            <option value="">Mover…</option>
            {folders
              .filter((f) => f !== item.folder)
              .map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => window.confirm(`Apagar "${item.title}"? Não dá para desfazer.`) && void remove({ itemId: item._id })}
            className="min-h-8 rounded-full px-2 text-xs font-semibold text-st-ajuste-texto hover:bg-creme"
          >
            Apagar
          </button>
        </div>
      </div>
    </li>
  );
}

function AddForm({ slug, folder, onDone }: { slug: string; folder: string; onDone: () => void }) {
  const add = useMutation(api.profile.add);
  const [kind, setKind] = useState<"link" | "nota" | "acesso">(folder === "Acessos e senhas" ? "acesso" : folder === "Anotações" ? "nota" : "link");
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const s = (k: string) => String(d.get(k) ?? "") || undefined;
    try {
      await add({ slug, folder, kind, title: s("title") ?? "", url: s("url"), note: s("note"), login: s("login"), secret: s("secret") });
      onDone();
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-creme p-4">
      <div className="flex flex-wrap gap-2">
        {(["link", "nota", "acesso"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-9 rounded-full px-3 text-sm font-semibold ${kind === k ? "bg-vinho text-white" : "bg-white"}`}>
            {k === "link" ? "Link" : k === "nota" ? "Anotação" : "Acesso e senha"}
          </button>
        ))}
      </div>
      <input name="title" placeholder="Nome (ex.: Pasta de fotos do show)" className={field} />
      {kind === "link" && <input name="url" placeholder="https://" inputMode="url" className={field} />}
      {kind === "nota" && <textarea name="note" rows={3} placeholder="Escreva aqui" className={`${field} py-2.5`} />}
      {kind === "acesso" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="login" placeholder="Login ou e-mail" className={field} />
          <input name="secret" placeholder="Senha" className={field} />
          <input name="url" placeholder="Site (opcional)" className={`${field} sm:col-span-2`} />
        </div>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="min-h-11 rounded-full bg-vinho px-5 text-sm font-bold text-white">
          Guardar
        </button>
        <button type="button" onClick={onDone} className={small}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FolderView({ slug, name, profile, onClose }: { slug: string; name: string; profile: Profile; onClose: () => void }) {
  const getUrl = useMutation(api.profile.generateUploadUrl);
  const addFiles = useMutation(api.profile.addFiles);
  const rename = useMutation(api.profile.renameFolder);
  const del = useMutation(api.profile.deleteFolder);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [adding, setAdding] = useState(false);
  const items = profile.items.filter((i) => i.folder === name).sort((a, b) => b.updatedAt - a.updatedAt);
  const fixed = !!FOLDER_HINT[name];

  const send = async (list: File[]) => {
    if (!list.length) return;
    setError(null);
    setBusy(`Subindo ${list.length} ${list.length === 1 ? "arquivo" : "arquivos"}…`);
    try {
      const files = await uploadAll(list, () => getUrl());
      await addFiles({ slug, folder: name, files });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void send([...e.dataTransfer.files]);
  };

  return (
    <section className={box} aria-label={`Pasta ${name}`}>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onClose} className={small}>
          ← Pastas
        </button>
        <h3 className="flex-1 text-lg font-bold">{name}</h3>
        {!fixed && (
          <>
            <button
              type="button"
              className={small}
              onClick={() => {
                const to = window.prompt("Novo nome da pasta", name);
                if (to && to.trim() !== name) void rename({ slug, from: name, to }).then(onClose).catch((e) => setError(errorText(e)));
              }}
            >
              Renomear
            </button>
            <button
              type="button"
              className={`${small} text-st-ajuste-texto`}
              onClick={() => window.confirm(`Apagar a pasta "${name}"?`) && void del({ slug, name }).then(onClose).catch((e) => setError(errorText(e)))}
            >
              Apagar pasta
            </button>
          </>
        )}
      </div>
      {FOLDER_HINT[name] && <p className="-mt-2 text-sm text-texto-2">{FOLDER_HINT[name]}</p>}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center ${over ? "border-rosa-forte bg-[#FFF6FA]" : "border-campo"}`}
      >
        <p className="text-[15px] font-semibold">{busy ?? "Arraste os arquivos para cá"}</p>
        <p className="text-sm text-texto-2">Fotos, vídeos, PDFs, o que a cliente mandar. Pode ser vários de uma vez.</p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <button type="button" disabled={!!busy} onClick={() => input.current?.click()} className="min-h-11 rounded-full bg-vinho px-5 text-sm font-bold text-white disabled:opacity-50">
            Escolher arquivos
          </button>
          <button type="button" onClick={() => setAdding((a) => !a)} className="min-h-11 rounded-full border-[1.5px] border-vinho px-4 text-sm font-semibold">
            Link, anotação ou senha
          </button>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            void send([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>
      {adding && <AddForm slug={slug} folder={name} onDone={() => setAdding(false)} />}
      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-texto-2">Pasta vazia.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((i) => (
            <ItemCard key={i._id} item={i} folders={profile.folders} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Folders({ data, slug }: { data: Panel; slug: string }) {
  const profile = useQuery(api.profile.get, { slug });
  const create = useMutation(api.profile.createFolder);
  const [open, setOpen] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);

  if (open && profile) return <FolderView slug={slug} name={open} profile={profile} onClose={() => setOpen(null)} />;

  return (
    <section className={box} aria-labelledby="pastas">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="pastas" className={h2}>
          Pastas
        </h2>
        {naming ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
              if (name) void create({ slug, name }).then((f) => setOpen(f));
              setNaming(false);
            }}
          >
            <input name="name" autoFocus placeholder="Nome da pasta" className={`${field} min-h-10 w-48`} />
            <button type="submit" className="min-h-10 rounded-full bg-vinho px-4 text-sm font-bold text-white">
              Criar
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setNaming(true)} className={small}>
            + Nova pasta
          </button>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data.folders.map((f) => (
          <li key={f.name}>
            <button type="button" onClick={() => setOpen(f.name)} className="flex w-full flex-col gap-3 rounded-2xl bg-creme p-4 text-left hover:bg-[#FFF6FA]">
              <span className="flex items-start justify-between gap-2">
                <FolderIcon color={data.client.accentColor} />
                {f.previewUrl && <img src={f.previewUrl} alt="" className="size-10 rounded-lg object-cover" />}
              </span>
              <span className="flex flex-col">
                <strong className="text-[15px] leading-tight">{f.name}</strong>
                <span className="text-[13px] text-texto-2">
                  {f.count === 0 ? "Vazia" : `${f.count} ${f.count === 1 ? "item" : "itens"}`}
                  {f.updatedAt ? ` · ${ago(f.updatedAt)}` : ""}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- Banco de conteúdo ---------- */

const TYPE_LABEL = { pauta: "Pauta", ideia: "Ideia", briefing: "Briefing" } as const;

function Bank({ data, base }: { data: Panel; base: string }) {
  const [tab, setTab] = useState<"banco" | "mandados" | "publicados">("banco");
  const tabs = [
    { id: "banco" as const, label: `Pautas, ideias e briefings (${data.bank.length})` },
    { id: "mandados" as const, label: `Arquivos que a cliente mandou (${data.sent.length})` },
    { id: "publicados" as const, label: `Já publicados (${data.published.length})` },
  ];
  const href = (b: Panel["bank"][number]) => (b.type === "briefing" ? `${base}/briefing/${b._id}` : `${base}/ideias`);
  return (
    <section className={box} aria-labelledby="banco">
      <h2 id="banco" className={h2}>
        Banco de conteúdo
      </h2>
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`min-h-10 rounded-full px-4 text-sm font-semibold ${tab === t.id ? "bg-vinho text-white" : "bg-creme"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "banco" &&
        (data.bank.length === 0 ? (
          <p className="text-sm text-texto-2">Nada esperando. O que a cliente mandar em Ideias e Briefing aparece aqui até virar post.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {data.bank.map((b) => (
              <li key={b._id}>
                <Link href={href(b)} className="flex h-full flex-col gap-1.5 rounded-2xl bg-creme p-4 hover:bg-[#FFF6FA]">
                  <span className="flex flex-wrap items-center gap-2 text-xs text-texto-2">
                    <span className="rounded-full bg-white px-2 font-bold leading-5 text-vinho">{TYPE_LABEL[b.type]}</span>
                    {b.who} · {ago(b.at)}
                    {b.month ? ` · para ${monthName(b.month).toLowerCase()}` : ""}
                  </span>
                  <strong className="text-[15px] leading-snug">{b.title}</strong>
                  {b.text && <span className="line-clamp-2 text-sm text-texto-3">{b.text}</span>}
                  {b.files > 0 && <span className="text-xs font-semibold text-rosa-forte">{b.files} anexo{b.files > 1 ? "s" : ""}</span>}
                </Link>
              </li>
            ))}
          </ul>
        ))}

      {tab === "mandados" &&
        (data.sent.length === 0 ? (
          <p className="text-sm text-texto-2">Os anexos que a cliente põe nas pautas e ideias aparecem aqui sozinhos. O que ela mandar por fora, você guarda em Recebidos da cliente.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.sent.map((f, i) => (
              <li key={i} className="flex flex-col overflow-hidden rounded-2xl border border-linha">
                <a href={f.url ?? undefined} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden">
                  {f.type.startsWith("image/") && f.url ? <img src={f.url} alt="" className="size-full object-cover" /> : <FileGlyph kind="arquivo" type={f.type} />}
                </a>
                <span className="flex flex-col gap-0.5 p-3">
                  <strong className="line-clamp-2 break-words text-sm">{f.name}</strong>
                  <span className="line-clamp-1 text-xs text-texto-2">{f.from}</span>
                  <span className="text-xs text-texto-2">
                    {f.who} · {ago(f.at)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ))}

      {tab === "publicados" &&
        (data.published.length === 0 ? (
          <p className="text-sm text-texto-2">Nenhum post marcado como postado ainda.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {data.published.map((c, i) => (
              <li key={c._id}>
                <Link href={`${base}/c/${c._id}`} className="flex flex-col gap-1">
                  <Thumb url={c.coverUrl} tone={i} label={FORMAT[c.format]} className="aspect-[4/5] w-full rounded-xl" />
                  <span className="line-clamp-1 text-xs font-semibold">{c.title}</span>
                  <span className="text-[11px] text-texto-2">{shortDate(c.date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}

/* ---------- Página ---------- */

export default function ClientPanelPage() {
  const { slug } = useParams<{ slug: string }>();
  const [today] = useState(() => todayISO());
  const data = useQuery(api.panel.get, { slug, today });
  if (data === undefined) return <Loading />;

  const c = data.client;
  const base = `/w/${c.slug}`;
  const online = data.people.find((p) => p.online);
  const lastSeen = data.people.find((p) => p.lastSeenAt);
  const attention = data.late.length + data.ajustes.length + data.bank.filter((b) => b.type === "briefing").length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-20 pt-6 md:px-6">
      <header className="flex flex-wrap items-center gap-4">
        <Avatar name={c.name} color={c.accentColor} url={c.photoUrl} size={72} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="titulo text-5xl md:text-6xl">{c.name}</h1>
          <span className="text-sm text-texto-2">
            {c.instagram ? `@${c.instagram.replace(/^@/, "")} · ` : ""}
            {online ? `${online.name} está online agora` : lastSeen?.lastSeenAt ? `${lastSeen.name} entrou ${ago(lastSeen.lastSeenAt)}` : "A equipe ainda não entrou no Hub"}
            {c.canEdit ? " · equipe edita os posts" : ""}
          </span>
        </div>
        <nav aria-label="Atalhos" className="flex flex-wrap gap-2">
          <Link href={base} className={buttonClass.primary}>
            Abrir o Hub
          </Link>
          <Link href={`${base}/calendario`} className={buttonClass.outline}>
            Calendário
          </Link>
          <Link href={`${base}/plano`} className={buttonClass.outline}>
            Plano
          </Link>
          <Link href={`${base}/historico`} className={buttonClass.outline}>
            Histórico
          </Link>
        </nav>
      </header>

      <section className={box} aria-labelledby="mes">
        <h2 id="mes" className={h2}>
          {monthName(data.month)} em números
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat n={data.counts.total - data.counts.ideia} label="posts no calendário" />
          <Stat n={data.counts.publicado} label="postados" tone="var(--color-st-publicado)" />
          <Stat n={data.counts.producao} label="em produção" />
          <Stat n={data.counts.aguardando} label="esperando aprovação" tone="var(--color-st-aguardando)" />
          <Stat n={data.counts.aprovado + data.counts.agendado} label="aprovados ou agendados" />
          <Stat n={data.late.length} label="atrasados" tone="var(--color-st-ajuste)" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.plans.map((p) => (
            <Link key={p.month} href={`${base}/plano?mes=${p.month}`} className="flex flex-col gap-0.5 rounded-2xl border border-linha px-4 py-3 hover:bg-creme">
              <span className="text-[13px] font-semibold text-texto-2">Plano de {monthName(p.month).toLowerCase()}</span>
              <strong className="text-[15px]">{p.status ? (p.theme || "Sem tema") : "Ainda não montado"}</strong>
              <span className="text-[13px] text-texto-3">
                {p.status ? `${PLAN_STATUS[p.status]}${p.decidedBy && p.status === "aprovado" ? ` por ${p.decidedBy}` : ""} · ${p.posts} posts` : "Toque para montar"}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={box} aria-labelledby="atencao">
          <h2 id="atencao" className={h2}>
            Precisa de você {attention > 0 && <span className="text-rosa-forte">({attention})</span>}
          </h2>
          {attention === 0 ? (
            <p className="text-sm text-texto-2">Nada atrasado, sem ajustes e sem briefing novo.</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {data.late.map((x) => (
                <PieceRow key={x._id} c={x} base={base} note="atrasado" />
              ))}
              {data.ajustes.map((x) => (
                <PieceRow key={x._id} c={x} base={base} note="pediu ajuste" />
              ))}
              {data.bank
                .filter((b) => b.type === "briefing")
                .map((b) => (
                  <li key={b._id}>
                    <Link href={`${base}/briefing/${b._id}`} className="flex flex-col rounded-xl px-2 py-2 hover:bg-creme">
                      <strong className="truncate text-[15px]">Briefing novo: {b.title}</strong>
                      <span className="text-[13px] text-texto-2">
                        {b.who} · {ago(b.at)}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </section>
        <section className={box} aria-labelledby="proximos">
          <h2 id="proximos" className={h2}>
            Próximos posts
          </h2>
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-texto-2">Nada marcado daqui para frente.</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {data.upcoming.map((x) => (
                <PieceRow key={x._id} c={x} base={base} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <Folders data={data} slug={c.slug} />
      <Bank data={data} base={base} />
    </main>
  );
}
