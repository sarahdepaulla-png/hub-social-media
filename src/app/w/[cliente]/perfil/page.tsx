"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Asterisk, Loading, buttonClass } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { useWorkspace } from "@/components/WorkspaceShell";

type Profile = FunctionReturnType<typeof api.profile.get>;
type Item = Profile["items"][number];
type Kind = Item["kind"];
type FileRef = { id: Id<"_storage">; name: string; type: string };

const field = "min-h-12 w-full border-[1.5px] border-campo bg-white px-3 text-base font-normal text-vinho";

const KINDS: { id: Kind; label: string }[] = [
  { id: "link", label: "Link" },
  { id: "acesso", label: "Acesso e senha" },
  { id: "arquivo", label: "Arquivo" },
  { id: "nota", label: "Anotação" },
];

const FOLDER_HINT: Record<string, string> = {
  "Drive e arquivos": "Pasta do Drive, fotos brutas, materiais que a cliente mandou.",
  "Acessos e senhas": "Instagram, Meta Business, TikTok, Canva. Só você vê.",
  Marca: "Logo, paleta, fontes, manual da marca.",
  Anotações: "Tom de voz, o que evitar, combinados, datas importantes.",
};

function defaultKind(folder: string): Kind {
  if (folder === "Acessos e senhas") return "acesso";
  if (folder === "Anotações") return "nota";
  if (folder === "Marca") return "arquivo";
  return "link";
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* navegador sem permissão de cópia */
    }
  };
  return { copied, copy };
}

export default function PerfilPage() {
  const ws = useWorkspace();
  const data = useQuery(api.profile.get, ws.viewerRole === "admin" ? { slug: ws.slug } : "skip");
  const [extra, setExtra] = useState<string[]>([]);
  const [newFolder, setNewFolder] = useState<string | null>(null);

  if (ws.viewerRole !== "admin") return <p className="px-6 py-16 text-lg">O perfil fica com o estúdio.</p>;
  if (data === undefined) return <Loading />;

  const folders = [...data.folders, ...extra.filter((f) => !data.folders.includes(f))];

  const createFolder = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = (newFolder ?? "").trim().slice(0, 60);
    if (name && !folders.includes(name)) setExtra((x) => [...x, name]);
    setNewFolder(null);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 pb-14 pt-4 md:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="titulo flex items-center gap-3 text-5xl md:text-7xl">
          Perfil <Asterisk size={40} color="var(--color-rosa)" />
        </h1>
        <p className="text-base text-texto-2">Tudo de {ws.name} num lugar só. A cliente não vê esta página.</p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {folders.map((f) => (
          <Folder key={f} slug={ws.slug} name={f} items={data.items.filter((i) => i.folder === f)} fixed={data.folders.slice(0, 4).includes(f)} />
        ))}
      </div>

      {newFolder === null ? (
        <button type="button" onClick={() => setNewFolder("")} className={`${buttonClass.outline} self-start`}>
          Nova pasta
        </button>
      ) : (
        <form onSubmit={createFolder} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold sm:max-w-sm">
            Nome da pasta
            <input autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} maxLength={60} placeholder="Ex.: Contratos" className={field} />
          </label>
          <button type="submit" className={buttonClass.primary}>Criar</button>
          <button type="button" onClick={() => setNewFolder(null)} className="min-h-12 px-2 text-[15px] font-semibold text-texto-2">
            Cancelar
          </button>
        </form>
      )}
    </main>
  );
}

function Folder({ slug, name, items, fixed }: { slug: string; name: string; items: Item[]; fixed: boolean }) {
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const rename = useMutation(api.profile.renameFolder);

  const submitRename = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const to = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (to && to !== name) await rename({ slug, from: name, to });
    setRenaming(false);
  };

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-peca bg-white p-5" aria-label={name}>
      <div className="flex items-start justify-between gap-3">
        {renaming ? (
          <form onSubmit={submitRename} className="flex min-w-0 flex-1 gap-2">
            <label className="sr-only" htmlFor={`pasta-${name}`}>Novo nome da pasta</label>
            <input id={`pasta-${name}`} name="name" autoFocus defaultValue={name} maxLength={60} className={field} />
            <button type="submit" className="min-h-12 shrink-0 px-2 text-[15px] font-semibold text-rosa-forte">Salvar</button>
          </form>
        ) : (
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="flex items-center gap-2 text-[22px] font-extrabold leading-tight tracking-[-0.04em]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0 fill-none stroke-rosa-forte stroke-2">
                <path d="M3.5 6.5h6l2 2h9v11h-17zM3.5 6.5V4.5h6l2 2" />
              </svg>
              <span className="truncate">{name}</span>
              <span className="text-sm font-semibold text-texto-2">{items.length || ""}</span>
            </h2>
            {FOLDER_HINT[name] && <p className="text-sm text-texto-2">{FOLDER_HINT[name]}</p>}
          </div>
        )}
        {!fixed && !renaming && items.length > 0 && (
          <button type="button" onClick={() => setRenaming(true)} className="min-h-11 shrink-0 text-sm font-semibold text-texto-2">
            Renomear
          </button>
        )}
      </div>

      {items.length > 0 && (
        <ul className="flex flex-col divide-y divide-linha border-t border-linha">
          {items.map((i) => (
            <ItemRow key={i._id} slug={slug} item={i} />
          ))}
        </ul>
      )}

      {adding ? (
        <ItemForm slug={slug} folder={name} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={`${buttonClass.secondary} min-h-11 self-start px-5 text-sm`}>
          Adicionar
        </button>
      )}
    </section>
  );
}

function ItemRow({ slug, item }: { slug: string; item: Item }) {
  const [editing, setEditing] = useState(false);
  const [show, setShow] = useState(false);
  const remove = useMutation(api.profile.remove);
  const { copied, copy } = useCopy();

  if (editing) {
    return (
      <li className="py-4">
        <ItemForm slug={slug} folder={item.folder} item={item} onDone={() => setEditing(false)} />
      </li>
    );
  }

  const small = "min-h-9 rounded-full border border-campo bg-white px-3 text-[13px] font-semibold";

  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex items-start justify-between gap-3">
        <strong className="min-w-0 break-words text-base">{item.title}</strong>
        <span className="flex shrink-0 gap-1">
          <button type="button" onClick={() => setEditing(true)} className="min-h-9 px-2 text-[13px] font-semibold text-texto-2">
            Editar
          </button>
          <button
            type="button"
            onClick={() => window.confirm(`Apagar "${item.title}"?`) && remove({ itemId: item._id })}
            className="min-h-9 px-2 text-[13px] font-semibold text-st-ajuste-texto"
          >
            Apagar
          </button>
        </span>
      </div>

      {item.url && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <a href={item.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-sm font-semibold text-rosa-forte underline">
            {item.url.replace(/^https?:\/\//, "")}
          </a>
          <button type="button" onClick={() => copy("url", item.url!)} className={small}>
            {copied === "url" ? "Copiado" : "Copiar link"}
          </button>
        </div>
      )}

      {item.kind === "acesso" && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-sm">
          {item.login && (
            <>
              <dt className="text-texto-2">Login</dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 break-all font-semibold">{item.login}</span>
                <button type="button" onClick={() => copy("login", item.login!)} className={small}>
                  {copied === "login" ? "Copiado" : "Copiar"}
                </button>
              </dd>
            </>
          )}
          {item.secret && (
            <>
              <dt className="text-texto-2">Senha</dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 break-all font-mono font-semibold">{show ? item.secret : "••••••••"}</span>
                <button type="button" onClick={() => setShow((s) => !s)} className={small} aria-pressed={show}>
                  {show ? "Esconder" : "Mostrar"}
                </button>
                <button type="button" onClick={() => copy("senha", item.secret!)} className={small}>
                  {copied === "senha" ? "Copiada" : "Copiar"}
                </button>
              </dd>
            </>
          )}
        </dl>
      )}

      {item.file && (
        <a href={item.file.url ?? "#"} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 rounded-xl bg-creme p-2 pr-4 hover:bg-[#FFF6FA]">
          {item.file.type.startsWith("image/") && item.file.url ? (
            <img src={item.file.url} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
          ) : (
            <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold uppercase text-texto-2">
              {item.file.name.split(".").pop()?.slice(0, 4) ?? "arq"}
            </span>
          )}
          <span className="min-w-0 truncate text-sm font-semibold">{item.file.name}</span>
        </a>
      )}

      {item.note && <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-texto-3">{item.note}</p>}
    </li>
  );
}

function ItemForm({ slug, folder, item, onDone }: { slug: string; folder: string; item?: Item; onDone: () => void }) {
  const add = useMutation(api.profile.add);
  const update = useMutation(api.profile.update);
  const uploadUrl = useMutation(api.profile.generateUploadUrl);
  const [kind, setKind] = useState<Kind>(item?.kind ?? defaultKind(folder));
  const [file, setFile] = useState<FileRef | null>(item?.file ? { id: item.file.id, name: item.file.name, type: item.file.type } : null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) return setError("Arquivo grande demais. Até 50 MB; para vídeos, use um link do Drive.");
    setUploading(true);
    setError(null);
    try {
      const url = await uploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": f.type || "application/octet-stream" }, body: f });
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      setFile({ id: storageId, name: f.name, type: f.type || "application/octet-stream" });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const text = (k: string) => String(d.get(k) ?? "").trim() || undefined;
    const values = {
      folder,
      kind,
      title: String(d.get("title") ?? ""),
      url: kind === "nota" ? undefined : text("url"),
      login: kind === "acesso" ? text("login") : undefined,
      secret: kind === "acesso" ? text("secret") : undefined,
      note: text("note"),
      file: kind === "arquivo" ? (file ?? undefined) : undefined,
    };
    setPending(true);
    setError(null);
    try {
      if (item) await update({ itemId: item._id, ...values });
      else await add({ slug, ...values });
      onDone();
    } catch (err) {
      setError(errorText(err));
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl bg-creme p-4">
      <div role="radiogroup" aria-label="Tipo" className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={kind === k.id}
            onClick={() => setKind(k.id)}
            className={`min-h-10 rounded-full px-4 text-sm font-semibold ${kind === k.id ? "bg-vinho text-white" : "bg-white text-texto-3"}`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Nome
        <input
          name="title"
          defaultValue={item?.title ?? ""}
          maxLength={120}
          placeholder={kind === "acesso" ? "Ex.: Instagram" : kind === "link" ? "Ex.: Drive de fotos" : kind === "arquivo" ? "Ex.: Logo principal" : "Ex.: Tom de voz"}
          className={field}
        />
      </label>

      {kind !== "nota" && (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {kind === "link" ? "Link" : "Link (opcional)"}
          <input name="url" type="text" inputMode="url" defaultValue={item?.url ?? ""} placeholder="https://" className={field} />
        </label>
      )}

      {kind === "acesso" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Login ou e-mail
            <input name="login" autoComplete="off" defaultValue={item?.login ?? ""} className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Senha
            <input name="secret" type="password" autoComplete="new-password" defaultValue={item?.secret ?? ""} className={field} />
          </label>
        </div>
      )}

      {kind === "arquivo" && (
        <div className="flex flex-col gap-1.5 text-sm font-semibold">
          Arquivo
          {file ? (
            <span className="flex min-w-0 items-center gap-3">
              <span className="min-w-0 truncate font-normal">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} className="min-h-10 shrink-0 text-sm font-semibold text-rosa-forte">
                Trocar
              </button>
            </span>
          ) : (
            <input type="file" onChange={(e) => pick(e.target.files?.[0])} disabled={uploading} className="min-h-12 text-sm font-normal" />
          )}
          {uploading && <span className="font-normal text-texto-2">Enviando</span>}
        </div>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {kind === "nota" ? "Anotação" : "Observação (opcional)"}
        <textarea
          name="note"
          rows={kind === "nota" ? 5 : 2}
          maxLength={6000}
          defaultValue={item?.note ?? ""}
          placeholder={kind === "acesso" ? "Ex.: código de 2 fatores vai para o celular da cliente" : ""}
          className={`${field} py-3 leading-relaxed`}
        />
      </label>

      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || uploading} className={`${buttonClass.primary} min-h-11 px-5 text-sm`}>
          {pending ? "Salvando" : "Salvar"}
        </button>
        <button type="button" onClick={onDone} className="min-h-11 px-3 text-sm font-semibold text-texto-2">
          Cancelar
        </button>
      </div>
    </form>
  );
}
