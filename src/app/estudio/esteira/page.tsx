"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Suspense, useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { Loading, Thumb } from "@/components/brand";
import { StatusMenu } from "@/components/StatusMenu";
import { PieceDrawer } from "@/components/PieceDrawer";
import { TrashButton } from "@/components/Trash";
import { DueBadge, OwnerBadge, ownerColor } from "@/components/Task";
import { errorText } from "@/components/content/DecisionSheet";
import { currentMonth, monthName, shiftMonth, shortDate } from "@/lib/dates";
import { FORMAT, type Status } from "@/lib/labels";

type Data = FunctionReturnType<typeof api.briefings.pipeline>;
type Piece = Data["contents"][number];
type Brief = Data["briefings"][number];

const STAGES: { id: string; label: string; statuses: Status[]; drop: Status }[] = [
  { id: "criacao", label: "Em criação", statuses: ["ideia", "producao"], drop: "producao" },
  { id: "aprovacao", label: "Aprovação", statuses: ["aguardando"], drop: "aguardando" },
  { id: "ajuste", label: "Ajuste", statuses: ["ajuste"], drop: "ajuste" },
  { id: "aprovado", label: "Aprovado", statuses: ["aprovado", "agendado"], drop: "aprovado" },
  { id: "postado", label: "Postado", statuses: ["publicado"], drop: "publicado" },
];

const column = "flex w-[82vw] max-w-[320px] shrink-0 snap-start flex-col gap-2.5 rounded-peca p-3 lg:w-auto lg:max-w-none lg:flex-1 lg:shrink lg:basis-0";

function ClientLabel({ c }: { c: { name: string; accentColor: string } }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-texto-3">
      <span aria-hidden="true" className="size-2 rounded-full" style={{ background: c.accentColor }} />
      {c.name}
    </span>
  );
}

type PautaItem = FunctionReturnType<typeof api.pautas.forStudio>[number];
const PAUTA_FMT: Record<string, { label: string; color: string }> = {
  reels: { label: "Reels", color: "#C2186B" },
  stories: { label: "Stories", color: "#8A63D2" },
  carrossel: { label: "Carrossel", color: "#0F7A6E" },
  imagem: { label: "Post", color: "#F0A030" },
  video: { label: "Vídeo", color: "#5C0F31" },
};

function PautaCard({ p }: { p: PautaItem }) {
  const f = p.format ? PAUTA_FMT[p.format] : null;
  return (
    <li className="flex flex-col gap-2 rounded-xl bg-white p-3">
      <span className="flex items-center justify-between gap-2">
        <ClientLabel c={p.client} />
        {p.status === "nova" && <span className="rounded-full bg-st-aguardando px-2 text-[11px] font-bold text-white">nova</span>}
      </span>
      <Link href={`/w/${p.client.slug}/ideias`} className="text-[15px] font-bold leading-tight hover:underline">
        {p.title}
      </Link>
      <span className="flex flex-wrap items-center gap-1.5 text-xs text-texto-2">
        {f && <span className="rounded-full px-2 py-0.5 font-bold text-white" style={{ background: f.color }}>{f.label}</span>}
        <span>{p.month ? monthName(p.month) : "Sem pressa"}</span>
        {p.files.length > 0 && <span>· {p.files.length} {p.files.length === 1 ? "anexo" : "anexos"}</span>}
      </span>
    </li>
  );
}

function BriefCard({ b }: { b: Brief }) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border-[1.5px] border-dashed border-campo bg-white p-3">
      <ClientLabel c={b.client} />
      <Link href={`/w/${b.client.slug}/briefing/${b._id}`} className="text-[15px] font-bold leading-tight hover:underline">
        {b.title}
      </Link>
      {(b.owner || b.dueDate) && (
        <span className="flex flex-wrap items-center gap-1.5">
          <OwnerBadge owner={b.owner} />
          <DueBadge due={b.dueDate} />
        </span>
      )}
      <span className="text-xs text-texto-2">
        {b.desiredDate ? `Para ${shortDate(b.desiredDate)}` : "Sem data"}
        {b.format ? `. ${FORMAT[b.format]}` : ""}. {b.authorIsStudio ? "Do estúdio" : `Pedido por ${b.authorName}`}
      </span>
      <Link href={`/w/${b.client.slug}/briefing/${b._id}`} className="min-h-9 content-center self-start text-sm font-semibold text-rosa-forte">
        Ler e começar
      </Link>
    </li>
  );
}

function PieceCard({ c, tone, onDrag, onOpen }: { c: Piece; tone: number; onDrag: (id: string | null) => void; onOpen: () => void }) {
  return (
    <li
      draggable
      onDragStart={() => onDrag(c._id)}
      onDragEnd={() => onDrag(null)}
      className="group/peca relative flex cursor-grab gap-3 rounded-xl bg-white p-2.5 active:cursor-grabbing"
    >
      <TrashButton contentId={c._id as Id<"contents">} title={c.title} editable reveal className="absolute right-1.5 top-1.5 z-10 size-7 border border-linha" />
      <button type="button" onClick={onOpen} draggable={false} aria-label={`Abrir a ficha de ${c.title}`} className="shrink-0">
        <Thumb url={c.coverUrl} tone={tone} label={c.coverUrl ? undefined : FORMAT[c.format]} className="h-[76px] w-[60px] rounded-lg" />
      </button>
      <span className="flex min-w-0 flex-col gap-1">
        <ClientLabel c={c.client} />
        <button type="button" onClick={onOpen} draggable={false} className="line-clamp-2 text-left text-sm font-bold leading-tight hover:underline">
          {c.title}
        </button>
        <span className="text-xs text-texto-2">
          {shortDate(c.date)}. {FORMAT[c.format]}
          {c.fromBriefing ? ". Do briefing" : ""}
        </span>
        {(c.owner || c.dueDate) && (
          <span className="flex flex-wrap items-center gap-1.5">
            <OwnerBadge owner={c.owner} />
            <DueBadge due={c.dueDate} done={["aprovado", "agendado", "publicado"].includes(c.status)} />
          </span>
        )}
        <StatusMenu contentId={c._id as Id<"contents">} status={c.status} editable short className="text-[11px]" />
      </span>
    </li>
  );
}

function Esteira() {
  const router = useRouter();
  const params = useSearchParams();
  const month = /^\d{4}-\d{2}$/.test(params.get("mes") ?? "") ? params.get("mes")! : currentMonth();
  const data = useQuery(api.briefings.pipeline, { month });
  const pautas = useQuery(api.pautas.forStudio, {});
  const setStatus = useMutation(api.contents.setStatus);
  const [only, setOnly] = useState<string>("");
  const [who, setWho] = useState<string>("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: Id<"contents">; slug: string } | null>(null);

  const visible = useMemo(() => {
    if (!data) return null;
    return {
      briefings: data.briefings.filter((b) => (!only || b.client.slug === only) && (!who || (who === "-" ? !b.owner : b.owner === who))),
      contents: data.contents.filter((c) => (!only || c.client.slug === only) && (!who || (who === "-" ? !c.owner : c.owner === who))),
      // Pautas ainda não têm responsável: somem quando o filtro de pessoa está ligado.
      pautas: who ? [] : (pautas ?? []).filter((p) => !only || p.client.slug === only),
    };
  }, [data, pautas, only, who]);

  if (data === undefined || visible === null) return <Loading />;

  const go = (delta: number) => router.replace(`/estudio/esteira?mes=${shiftMonth(month, delta)}`, { scroll: false });

  const drop = async (stage: (typeof STAGES)[number]) => {
    setOver(null);
    const piece = visible.contents.find((c) => c._id === dragId);
    setDragId(null);
    if (!piece || stage.statuses.includes(piece.status)) return;
    setError(null);
    try {
      await setStatus({ contentId: piece._id as Id<"contents">, status: stage.drop });
    } catch (err) {
      setError(errorText(err));
    }
  };

  // Nas etapas em andamento, o prazo mais perto vem primeiro.
  const byDue = (x: Piece, y: Piece) => (x.dueDate ?? "9").localeCompare(y.dueDate ?? "9") || x.date.localeCompare(y.date);
  const byStage = STAGES.map((s) => {
    const items = visible.contents.filter((c) => s.statuses.includes(c.status));
    return { ...s, items: s.id === "criacao" || s.id === "ajuste" || s.id === "aprovacao" ? [...items].sort(byDue) : items };
  });
  const newFor = only || (data.clients.length === 1 ? data.clients[0].slug : "");

  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 pb-14 pt-10">
      <header className="flex flex-wrap items-end justify-between gap-4 px-6">
        <div className="flex flex-col gap-1">
          <span className="text-[15px] text-texto-2">Do briefing ao post</span>
          <h1 className="titulo text-6xl md:text-7xl">Esteira</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" aria-label="Mês anterior" onClick={() => go(-1)} className="flex size-11 items-center justify-center rounded-full hover:bg-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <span className="min-w-24 text-center text-lg font-extrabold capitalize tracking-[-0.03em]">
            {monthName(month)} {month.slice(0, 4)}
          </span>
          <button type="button" aria-label="Próximo mês" onClick={() => go(1)} className="flex size-11 items-center justify-center rounded-full hover:bg-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
          {newFor ? (
            <Link href={`/w/${newFor}/briefing/novo`} className="ml-2 inline-flex min-h-11 items-center rounded-full bg-vinho px-5 text-sm font-semibold text-white">
              Novo briefing
            </Link>
          ) : (
            <label className="relative ml-2 inline-flex min-h-11 items-center rounded-full bg-vinho px-5 text-sm font-semibold text-white">
              Novo briefing
              <select
                aria-label="Novo briefing para qual cliente"
                value=""
                onChange={(e) => e.target.value && router.push(`/w/${e.target.value}/briefing/novo`)}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                <option value="">Para qual cliente?</option>
                {data.clients.map((c) => (
                  <option key={c._id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </header>

      <div role="group" aria-label="Filtrar por cliente" className="flex gap-2 overflow-x-auto px-6 pb-1">
        {[{ slug: "", name: "Todos", accentColor: "var(--color-vinho)" }, ...data.clients].map((c) => (
          <button
            key={c.slug || "todos"}
            type="button"
            aria-pressed={only === c.slug}
            onClick={() => setOnly(c.slug)}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border-[1.5px] px-4 text-sm font-semibold ${
              only === c.slug ? "border-vinho bg-vinho text-white" : "border-campo bg-white text-vinho"
            }`}
          >
            {c.slug && <span aria-hidden="true" className="size-2 rounded-full" style={{ background: c.accentColor }} />}
            {c.name}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Filtrar por responsável" className="-mt-2 flex items-center gap-2 overflow-x-auto px-6 pb-1">
        <span className="shrink-0 text-sm font-semibold text-texto-2">Com quem</span>
        {[{ id: "", label: "Todo mundo" }, ...data.team.map((t) => ({ id: t, label: t })), { id: "-", label: "Sem responsável" }].map((o) => (
          <button
            key={o.id || "todos"}
            type="button"
            aria-pressed={who === o.id}
            onClick={() => setWho(o.id)}
            className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold ${
              who === o.id ? "border-vinho bg-vinho text-white" : "border-campo bg-white text-vinho"
            }`}
          >
            {o.id && o.id !== "-" && <span aria-hidden="true" className="size-2 rounded-full" style={{ background: ownerColor(o.id) }} />}
            {o.label}
          </button>
        ))}
      </div>

      {/* Atalhos para as etapas no celular, onde as colunas rolam de lado */}
      <nav aria-label="Etapas" className="flex gap-4 overflow-x-auto px-6 text-sm lg:hidden">
        <a href="#etapa-pautas" className="min-h-9 shrink-0 content-center font-semibold text-rosa-forte">Pautas {visible.pautas.length}</a>
        <a href="#etapa-briefing" className="min-h-9 shrink-0 content-center font-semibold text-rosa-forte">Briefing {visible.briefings.length}</a>
        {byStage.map((s) => (
          <a key={s.id} href={`#etapa-${s.id}`} className="min-h-9 shrink-0 content-center font-semibold text-rosa-forte">
            {s.label} {s.items.length}
          </a>
        ))}
      </nav>

      {error && <p role="alert" className="px-6 text-sm font-semibold text-st-ajuste-texto">{error}</p>}

      <div className="flex snap-x snap-mandatory scroll-px-6 gap-3 overflow-x-auto px-6 pb-4 lg:snap-none">
        <section id="etapa-pautas" aria-labelledby="t-pautas" className={`${column} bg-[#E3F1EF]`}>
          <h2 id="t-pautas" className="flex items-baseline justify-between px-1 text-[17px] font-extrabold tracking-[-0.03em]">
            Pautas da cliente <span className="text-sm font-semibold text-texto-2">{visible.pautas.length}</span>
          </h2>
          {visible.pautas.length === 0 ? (
            <p className="px-1 text-sm text-texto-2">Nenhuma pauta esperando.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {visible.pautas.map((p) => (
                <PautaCard key={p._id} p={p} />
              ))}
            </ul>
          )}
        </section>

        <section id="etapa-briefing" aria-labelledby="t-briefing" className={`${column} bg-rosa/45`}>
          <h2 id="t-briefing" className="flex items-baseline justify-between px-1 text-[17px] font-extrabold tracking-[-0.03em]">
            Briefing <span className="text-sm font-semibold text-texto-2">{visible.briefings.length}</span>
          </h2>
          {visible.briefings.length === 0 ? (
            <p className="px-1 text-sm text-texto-2">Nenhum pedido em aberto.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {visible.briefings.map((b) => (
                <BriefCard key={b._id} b={b} />
              ))}
            </ul>
          )}
        </section>

        {byStage.map((s) => (
          <section
            key={s.id}
            id={`etapa-${s.id}`}
            aria-labelledby={`t-${s.id}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(s.id);
            }}
            onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
            onDrop={() => drop(s)}
            className={`${column} ${over === s.id ? "bg-[#FFE3F1] outline outline-2 -outline-offset-2 outline-rosa-forte" : "bg-white/55"}`}
          >
            <h2 id={`t-${s.id}`} className="flex items-baseline justify-between px-1 text-[17px] font-extrabold tracking-[-0.03em]">
              {s.label} <span className="text-sm font-semibold text-texto-2">{s.items.length}</span>
            </h2>
            {s.items.length === 0 ? (
              <p className="px-1 text-sm text-texto-2">Nada aqui.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {s.items.map((c, i) => (
                  <PieceCard key={c._id} c={c} tone={i} onDrag={setDragId} onOpen={() => setOpen({ id: c._id as Id<"contents">, slug: c.client.slug })} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <p className="hidden px-6 text-sm text-texto-2 lg:block">Clique num card para ver briefing, legenda e ajustes. Arraste para outra coluna ou toque no status para mudar a etapa.</p>
      {open && <PieceDrawer key={open.id} contentId={open.id} slug={open.slug} onClose={() => setOpen(null)} />}
    </main>
  );
}

export default function EsteiraPage() {
  return (
    <Suspense>
      <Esteira />
    </Suspense>
  );
}
