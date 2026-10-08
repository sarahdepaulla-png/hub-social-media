"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@convex/_generated/dataModel";
import { Avatar, Loading, buttonClass } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { stamp } from "@/lib/dates";
import { parseNiches } from "@/lib/niches";

type Client = FunctionReturnType<typeof api.clients.listAdmin>[number];
const field = "min-h-11 border border-campo bg-white px-3 text-[15px] font-normal";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ColorField({ name, label, value, onChange }: { name: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
      {label}
      <span className="flex items-center gap-2">
        <input type="color" aria-label={`${label}, seletor`} value={value || "#5c0f31"} onChange={(e) => onChange(e.target.value)} className="size-11 cursor-pointer border border-campo bg-white p-1" />
        <input name={name} value={value} onChange={(e) => onChange(e.target.value)} placeholder="#RRGGBB" className={`${field} w-28 font-mono`} />
      </span>
    </label>
  );
}

function NewClient() {
  const create = useMutation(api.clients.create);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [accent, setAccent] = useState("#2F8F9D");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setError(null);
    try {
      await create({
        name,
        slug: slug || slugify(name),
        description: String(d.get("description") ?? ""),
        niches: parseNiches(String(d.get("niches") ?? "")),
        accentColor: accent,
      });
      setName("");
      setSlug("");
      setTouched(false);
      setOpen(false);
    } catch (err) {
      setError(errorText(err));
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${buttonClass.primary} self-start`}>
        Adicionar cliente
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-peca bg-white p-5">
      <h2 className="text-xl font-extrabold tracking-[-0.04em]">Novo cliente</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Nome
          <input
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!touched) setSlug(slugify(e.target.value));
            }}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Endereço do workspace
          <span className="flex items-center gap-1 text-sm font-normal text-texto-2">
            /w/
            <input
              required
              value={slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value));
                setTouched(true);
              }}
              className={`${field} flex-1`}
            />
          </span>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        Descrição curta
        <input name="description" placeholder="Ex.: Fisioterapeuta e professora" className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        Nichos, separados por vírgula
        <input name="niches" placeholder="fisioterapia, ensino" className={field} />
        <span className="font-normal text-texto-2">Definem quais datas da biblioteca aparecem para este cliente.</span>
      </label>
      <ColorField name="accent" label="Cor de destaque" value={accent} onChange={setAccent} />
      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className={buttonClass.primary}>Criar cliente</button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass.outline}>Cancelar</button>
      </div>
    </form>
  );
}

function ImageUpload({ clientId, kind, url }: { clientId: Id<"clients">; kind: "logo" | "foto"; url: string | null }) {
  const uploadUrl = useMutation(api.media.generateUploadUrl);
  const setImage = useMutation(api.clients.setImage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <label className="flex cursor-pointer items-center gap-3 text-[13px] font-semibold">
      <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-campo bg-white">
        {url ? <img src={url} alt="" className="size-full object-cover" /> : <span className="text-lg text-texto-2">+</span>}
      </span>
      <span className="flex flex-col">
        {kind === "logo" ? "Logo" : "Foto"}
        <span className="font-normal text-texto-2">{busy ? "Enviando" : url ? "Trocar imagem" : "Escolher imagem"}</span>
        {error && <span role="alert" className="text-st-ajuste-texto">{error}</span>}
      </span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            const u = await uploadUrl();
            const res = await fetch(u, { method: "POST", headers: { "Content-Type": file.type }, body: file });
            if (!res.ok) throw new Error("Falha no envio");
            const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
            await setImage({ clientId, kind, storageId });
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
    </label>
  );
}

function accessMessage(name: string | null, link: string) {
  return `Oi${name ? `, ${name}` : ""}! Seu planejamento de conteúdo está aqui:\n${link}\n\nÉ só tocar no link. Ele é só seu, não compartilhe.`;
}

function PersonRow({ person, mailReady }: { person: Client["people"][number]; mailReady: boolean }) {
  const revoke = useMutation(api.invites.revoke);
  const sendEmail = useMutation(api.invites.sendEmail);
  const reset = useMutation(api.invites.resetLink);
  const [copied, setCopied] = useState(false);
  const link = person.token && typeof window !== "undefined" ? `${window.location.origin}/acesso/${person.token}` : null;
  const msg = link ? accessMessage(person.name, link) : "";
  return (
    <li className="flex flex-col gap-2 border-t border-linha py-3 text-sm last:border-b">
      <span className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{person.name ?? person.email}</span>
          <span className="truncate text-texto-2">
            {person.name ? `${person.email}, ` : ""}
            {person.accepted ? "já entrou" : "ainda não entrou"}
          </span>
          <span className={`text-[13px] ${person.emailError ? "font-semibold text-st-ajuste-texto" : "text-texto-2"}`}>
            {person.emailPending
              ? "Enviando convite por e-mail"
              : person.emailError
                ? person.emailError
                : person.emailedAt
                  ? `Convite por e-mail enviado ${stamp(person.emailedAt)}`
                  : null}
          </span>
        </span>
        <button
          type="button"
          onClick={() => confirm(`Tirar o acesso de ${person.name ?? person.email}? O link para de funcionar na hora.`) && revoke({ inviteId: person._id })}
          className="min-h-9 shrink-0 text-sm font-semibold text-st-ajuste-texto"
        >
          Tirar acesso
        </button>
      </span>
      {link && (
        <span className="flex flex-wrap gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(msg)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center rounded-full bg-st-agendado px-3.5 text-[13px] font-semibold text-white"
          >
            Enviar link no WhatsApp
          </a>
          {mailReady && (
            <button
              type="button"
              disabled={person.emailPending}
              onClick={() => sendEmail({ inviteId: person._id })}
              className="inline-flex min-h-9 items-center rounded-full bg-vinho px-3.5 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {person.emailedAt ? "Reenviar por e-mail" : "Enviar por e-mail"}
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            }}
            className="min-h-9 rounded-full border border-campo bg-white px-3.5 text-[13px] font-semibold"
          >
            {copied ? "Link copiado" : "Copiar link"}
          </button>
          <button
            type="button"
            onClick={() => confirm("Gerar um link novo? O link atual para de funcionar.") && reset({ inviteId: person._id }).then(() => setCopied(false))}
            className="min-h-9 px-1 text-[13px] font-semibold text-texto-2"
          >
            Gerar link novo
          </button>
        </span>
      )}
    </li>
  );
}

function Invite({ client, mailReady }: { client: Client; mailReady: boolean }) {
  const invite = useMutation(api.invites.create);
  const [byEmail, setByEmail] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await invite({ email, name: name || undefined, role: "cliente", clientSlug: client.slug, sendEmail: mailReady && byEmail });
      setEmail("");
      setName("");
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-bold">Quem acessa</h3>
      <p className="text-sm text-texto-2">Cada pessoa recebe um link próprio. Quem toca no link entra direto, sem senha nem e-mail.</p>
      {client.people.length === 0 ? (
        <p className="text-sm text-texto-2">Ninguém ainda.</p>
      ) : (
        <ul className="flex flex-col">
          {client.people.map((p) => (
            <PersonRow key={p._id} person={p} mailReady={mailReady} />
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`nome-${client._id}`}>Nome</label>
        <input id={`nome-${client._id}`} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className={`${field} w-32`} />
        <label className="sr-only" htmlFor={`email-${client._id}`}>E-mail</label>
        <input id={`email-${client._id}`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@cliente.com" className={`${field} min-w-0 flex-1`} />
        <button type="submit" className="min-h-11 rounded-full bg-vinho px-5 text-sm font-semibold text-white">Criar acesso</button>
      </form>
      {mailReady ? (
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={byEmail} onChange={(e) => setByEmail(e.target.checked)} className="size-[18px] accent-rosa-forte" />
          Mandar o convite com o link para o e-mail da pessoa
        </label>
      ) : (
        <p className="text-[13px] text-texto-2">O envio por e-mail ainda não está ligado. Por enquanto, mande o link pelo WhatsApp.</p>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
    </div>
  );
}

function ClientCard({ client, mailReady }: { client: Client; mailReady: boolean }) {
  const update = useMutation(api.clients.update);
  const setCanEdit = useMutation(api.clients.setClientCanEdit);
  const [open, setOpen] = useState(false);
  const [accent, setAccent] = useState(client.accentColor);
  const [secondary, setSecondary] = useState(client.secondaryColor ?? "");
  const [state, setState] = useState<"idle" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setError(null);
    try {
      await update({
        clientId: client._id,
        name: String(d.get("name")),
        description: String(d.get("description") ?? ""),
        niches: parseNiches(String(d.get("niches") ?? "")),
        accentColor: accent,
        secondaryColor: secondary || undefined,
        active: d.get("active") === "on",
      });
      setState("saved");
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <li className="border-t border-linha last:border-b">
      <div className="flex items-center justify-between gap-4 py-4">
        <span className="flex items-center gap-3">
          <Avatar name={client.name} color={client.accentColor} url={client.photoUrl} size={44} />
          <span className="flex flex-col">
            <strong className="text-[17px]">
              {client.name}
              {!client.active && <span className="font-normal text-texto-2"> (pausado)</span>}
            </strong>
            <span className="text-[13px] text-texto-2">
              /w/{client.slug}, {client.people.length} {client.people.length === 1 ? "acesso" : "acessos"}
              {client.clientCanEdit && ", equipe edita as peças"}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          <Link href={`/w/${client.slug}`} className="min-h-10 content-center px-2 text-sm font-semibold text-rosa-forte">Abrir</Link>
          <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="min-h-10 rounded-full border border-campo bg-white px-4 text-sm font-semibold">
            {open ? "Fechar" : "Editar"}
          </button>
        </span>
      </div>
      {open && (
        <div className="grid gap-8 pb-6 md:grid-cols-2">
          <form onSubmit={submit} onChange={() => setState("idle")} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
              Nome
              <input name="name" required defaultValue={client.name} className={field} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
              Descrição
              <input name="description" defaultValue={client.description ?? ""} className={field} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
              Nichos
              <input name="niches" defaultValue={client.niches.join(", ")} className={field} />
            </label>
            <div className="flex flex-wrap gap-4">
              <ColorField name="accent" label="Cor de destaque" value={accent} onChange={(v) => { setAccent(v); setState("idle"); }} />
              <ColorField name="secondary" label="Cor secundária" value={secondary} onChange={(v) => { setSecondary(v); setState("idle"); }} />
            </div>
            <div className="flex flex-wrap gap-5">
              <ImageUpload clientId={client._id} kind="foto" url={client.photoUrl} />
              <ImageUpload clientId={client._id} kind="logo" url={client.logoUrl} />
            </div>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" name="active" defaultChecked={client.active} className="size-[18px] accent-rosa-forte" />
              Cliente ativo (aparece na visão geral)
            </label>
            {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
            <button type="submit" className="min-h-11 self-start rounded-full bg-vinho px-5 text-sm font-semibold text-white">
              {state === "saved" ? "Salvo" : "Salvar"}
            </button>
          </form>
          <div className="flex flex-col gap-6">
            <label className="flex items-start gap-3 rounded-peca bg-white p-4 text-sm">
              <input
                type="checkbox"
                checked={client.clientCanEdit}
                onChange={(e) => setCanEdit({ clientId: client._id, value: e.target.checked })}
                className="mt-0.5 size-[18px] shrink-0 accent-rosa-forte"
              />
              <span className="flex flex-col gap-0.5">
                <strong>A equipe de {client.name} pode editar as peças</strong>
                <span className="text-texto-2">Escrever legenda, subir foto e vídeo, trocar a capa e os dados. Status e envio para aprovação continuam com você.</span>
              </span>
            </label>
            <Invite client={client} mailReady={mailReady} />
          </div>
        </div>
      )}
    </li>
  );
}

export default function ClientesPage() {
  const clients = useQuery(api.clients.listAdmin, {});
  const mail = useQuery(api.invites.mailStatus, {});
  if (clients === undefined || mail === undefined) return <Loading />;
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <h1 className="titulo text-6xl">Clientes e acessos</h1>
      {mail.ready ? (
        <p className="rounded-peca bg-white px-5 py-4 text-sm">
          Convites por e-mail ligados. Eles saem de <strong>{mail.from}</strong>.
        </p>
      ) : (
        <details className="rounded-peca bg-white px-5 py-4 text-sm">
          <summary className="cursor-pointer font-semibold">Ligar o envio de convites por e-mail</summary>
          <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-texto-3">
            <li>Na sua Conta Google, ative a verificação em duas etapas.</li>
            <li>Abra myaccount.google.com/apppasswords, crie uma senha de app com o nome &ldquo;Hub&rdquo; e copie os 16 caracteres.</li>
            <li>Na Vercel, em Settings, Environment Variables, crie GMAIL_USER (seu Gmail) e GMAIL_APP_PASSWORD (a senha de app).</li>
            <li>Em Deployments, clique em Redeploy na publicação mais recente.</li>
          </ol>
        </details>
      )}
      <NewClient />
      <ul className="flex flex-col">
        {clients.map((c) => (
          <ClientCard key={c._id} client={c} mailReady={mail.ready} />
        ))}
      </ul>
    </main>
  );
}
