"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Suspense, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Loading, SelectionBox, StatusTag, buttonClass } from "@/components/brand";
import { BriefingForm, Step, field } from "@/components/briefing/BriefingForm";
import { errorText } from "@/components/content/DecisionSheet";
import { useWorkspace } from "@/components/WorkspaceShell";
import { DueBadge, OwnerBadge } from "@/components/Task";
import { longDate, stamp, todayISO } from "@/lib/dates";
import { BRIEF_STATUS, FORMAT, PLATFORM, type Format, type Platform } from "@/lib/labels";

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Painel da admin: escolhe data e formato e leva o briefing para o calendário. */
function StartPanel({ briefingId, desiredDate, platform, format, slug }: { briefingId: Id<"briefings">; desiredDate: string | null; platform: Platform | null; format: Format | null; slug: string }) {
  const start = useMutation(api.briefings.start);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const id = await start({ briefingId, date: String(d.get("date")), platform: d.get("platform") as Platform, format: d.get("format") as Format });
      router.push(`/w/${slug}/c/${id}/editar`);
    } catch (err) {
      setError(errorText(err));
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-peca bg-vinho p-5 text-white md:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-[22px] font-extrabold tracking-[-0.04em]">Começar a criação</h2>
        <p className="text-sm text-white/80">Vira uma peça em produção no calendário, já com o briefing anexado.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Data
          <input name="date" type="date" required defaultValue={desiredDate ?? todayISO()} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Plataforma
          <select name="platform" defaultValue={platform ?? "instagram"} className={field}>
            {Object.entries(PLATFORM).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Formato
          <select name="format" defaultValue={format ?? "carrossel"} className={field}>
            {Object.entries(FORMAT).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-rosa">{error}</p>}
      <button type="submit" disabled={pending} className={`${buttonClass.secondary} self-start`}>
        {pending ? "Criando" : "Criar a peça e abrir o editor"}
      </button>
    </form>
  );
}

function BriefingView() {
  const { id } = useParams<{ id: string }>();
  const briefingId = id as Id<"briefings">;
  const ws = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const b = useQuery(api.briefings.get, { briefingId });
  const team = useQuery(api.team.list, ws.viewerRole === "admin" ? {} : "skip");
  const update = useMutation(api.briefings.update);
  const archive = useMutation(api.briefings.archive);
  const remove = useMutation(api.briefings.remove);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (b === undefined) return <Loading />;
  const admin = b.viewerRole === "admin";
  const st = BRIEF_STATUS[b.status];
  const base = `/w/${ws.slug}`;

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pb-16 pt-4">
      <header className="flex flex-col gap-3">
        <Link href={admin ? "/estudio/esteira" : base} className="min-h-11 content-center self-start text-sm font-semibold text-rosa-forte">
          {admin ? "Voltar para a esteira" : "Voltar para o início"}
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
          <span aria-hidden="true" className="size-2 rounded-full" style={{ background: st.color }} />
          {st.label}
        </span>
        <h1 className="titulo text-[40px] leading-[0.95] md:text-[64px]">{b.title}</h1>
        <span className="text-sm text-texto-2">
          Briefing aberto por {b.authorName}, {stamp(b.at)}
        </span>
        {admin && (b.owner || b.dueDate) && (
          <span className="flex flex-wrap items-center gap-2">
            <OwnerBadge owner={b.owner} />
            <DueBadge due={b.dueDate} done={b.content?.status === "publicado" || b.content?.status === "aprovado" || b.content?.status === "agendado"} />
          </span>
        )}
        {params.get("enviado") && !admin && b.status === "novo" && (
          <SelectionBox className="ml-1.5 mt-2 self-start px-3.5 py-2.5 text-base">Enviado. O estúdio já recebeu.</SelectionBox>
        )}
      </header>

      {b.content && (
        <Link href={`${base}/c/${b.content._id}`} className="flex items-center justify-between gap-4 rounded-peca bg-white p-5 hover:bg-[#FFF6FA]">
          <span className="flex flex-col gap-1">
            <strong className="text-base">Virou conteúdo para {longDate(b.content.date)}</strong>
            <StatusTag status={b.content.status} />
          </span>
          <span className="text-sm font-semibold text-rosa-forte">Abrir a peça</span>
        </Link>
      )}

      {admin && b.status === "novo" && !editing && (
        <StartPanel briefingId={briefingId} desiredDate={b.desiredDate} platform={b.platform} format={b.format} slug={ws.slug} />
      )}

      {editing ? (
        <BriefingForm
          team={admin ? (team ?? []) : undefined}
          initial={{
            title: b.title,
            platform: b.platform ?? undefined,
            format: b.format ?? undefined,
            desiredDate: b.desiredDate ?? undefined,
            dueDate: b.dueDate ?? undefined,
            owner: b.owner ?? undefined,
            objective: b.objective ?? undefined,
            body: b.body,
            links: b.links,
          }}
          submitLabel="Salvar briefing"
          pendingLabel="Salvando"
          onCancel={() => setEditing(false)}
          onSubmit={async (v) => {
            await update({ briefingId, ...v });
            setEditing(false);
          }}
        />
      ) : (
        <div className="flex flex-col gap-8">
          <Step n={1} title="O que é o conteúdo">
            <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[15px]">
              <dt className="text-texto-2">Tema</dt>
              <dd className="font-semibold">{b.title}</dd>
              <dt className="text-texto-2">Formato</dt>
              <dd>{b.format ? FORMAT[b.format] : "O estúdio decide"}</dd>
              <dt className="text-texto-2">Plataforma</dt>
              <dd>{b.platform ? PLATFORM[b.platform] : "O estúdio decide"}</dd>
              <dt className="text-texto-2">Quando</dt>
              <dd className="capitalize">{b.desiredDate ? longDate(b.desiredDate) : "Sem data definida"}</dd>
            </dl>
          </Step>
          <Step n={2} title="Briefing">
            {b.objective && (
              <span className="self-start rounded-full bg-rosa px-3 py-1 text-sm font-semibold text-vinho">{b.objective}</span>
            )}
            <p className="whitespace-pre-wrap text-[17px] leading-relaxed">{b.body}</p>
          </Step>
          <Step n={3} title="Links">
            {b.links.length === 0 ? (
              <p className="text-[15px] text-texto-2">Nenhum link.</p>
            ) : (
              <ul className="flex flex-col">
                {b.links.map((l) => (
                  <li key={l} className="border-b border-linha last:border-b-0">
                    <a href={l} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold">{host(l)}</span>
                        <span className="block truncate text-xs text-texto-2">{l}</span>
                      </span>
                      <span aria-hidden="true" className="text-rosa-forte">↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Step>
        </div>
      )}

      {!editing && (
        <div className="flex flex-wrap gap-3 border-t border-linha pt-6">
          {b.canEdit && (
            <button type="button" onClick={() => setEditing(true)} className={buttonClass.outline}>
              Editar briefing
            </button>
          )}
          {admin && b.status !== "em_criacao" && (
            <button type="button" onClick={() => act(() => archive({ briefingId, archived: b.status !== "arquivado" }))} className={buttonClass.outline}>
              {b.status === "arquivado" ? "Voltar para a esteira" : "Arquivar"}
            </button>
          )}
          {b.canEdit && b.status !== "em_criacao" && (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("Apagar este briefing?")) return;
                act(async () => {
                  await remove({ briefingId });
                  router.replace(admin ? "/estudio/esteira" : base);
                });
              }}
              className={buttonClass.danger}
            >
              Apagar
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <BriefingView />
    </Suspense>
  );
}
