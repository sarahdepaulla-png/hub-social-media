"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { Asterisk, Avatar, SelectionBox, Thumb } from "@/components/brand";
import { StatusMenu } from "@/components/StatusMenu";
import { PieceDrawer } from "@/components/PieceDrawer";
import { TrashButton } from "@/components/Trash";
import { errorText } from "@/components/content/DecisionSheet";
import { addDays, longDate, monthName, shortDate, todayISO } from "@/lib/dates";
import { STATUS, type Status } from "@/lib/labels";

export type Home = FunctionReturnType<typeof api.dashboard.studioHome>;
export type Row = FunctionReturnType<typeof api.clients.listForStudio>[number];
type Open = { id: Id<"contents">; slug: string } | null;

const TZ = "America/Sao_Paulo";

/** Hora em São Paulo, atualizada a cada 20 segundos. */
export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(t);
  }, []);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(now));
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(now);
  const greeting = hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";
  return { greeting, time, today: todayISO(now) };
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/* ---------- Foto e nome ---------- */

function Portrait({ me }: { me: Home["me"] }) {
  const upload = useMutation(api.media.generateUploadUrl);
  const save = useMutation(api.dashboard.updateProfile);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Escolha uma imagem.");
    setBusy(true);
    setError(null);
    try {
      const url = await upload();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = await res.json();
      await save({ photoId: storageId });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const handle = "absolute size-2.5 border-[1.5px] border-vinho bg-white";
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label={me.photoUrl ? "Trocar sua foto" : "Adicionar sua foto"}
        className="group relative rotate-2 outline outline-[1.5px] outline-offset-[6px] outline-vinho transition-transform hover:rotate-0"
      >
        <span className={`${handle} -left-[11px] -top-[11px]`} />
        <span className={`${handle} -right-[11px] -top-[11px]`} />
        <span className={`${handle} -bottom-[11px] -left-[11px]`} />
        <span className={`${handle} -bottom-[11px] -right-[11px]`} />
        <span className="block h-[124px] w-[98px] overflow-hidden rounded-peca bg-white md:h-[260px] md:w-[210px]">
          {me.photoUrl ? (
            <img src={me.photoUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-2 bg-creme text-vinho">
              <span className="text-[44px] font-extrabold leading-none tracking-[-0.06em] md:text-[72px]">{(me.name ?? "S").charAt(0)}</span>
              <span className="hidden text-sm font-semibold md:block">Adicionar foto</span>
            </span>
          )}
        </span>
        <span className="absolute -bottom-4 -right-4 rotate-[-8deg] whitespace-nowrap rounded-full bg-vinho px-2.5 py-1 text-[11px] font-bold text-white shadow-md md:-right-5 md:px-3 md:py-1.5 md:text-xs">
          {busy ? "Enviando" : me.photoUrl ? "Trocar foto" : "Sua foto aqui"}
        </span>
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {error && <p role="alert" className="max-w-[200px] text-center text-xs font-semibold text-vinho">{error}</p>}
    </div>
  );
}

function NameEditor({ name, onDone }: { name: string; onDone: () => void }) {
  const save = useMutation(api.dashboard.updateProfile);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await save({ name: value });
          onDone();
        } catch (err) {
          setError(errorText(err));
        }
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <label className="sr-only" htmlFor="meu-nome">Como quer ser chamada</label>
      <input
        id="meu-nome"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-11 w-56 rounded-full border-[1.5px] border-vinho bg-white px-4 text-base text-vinho"
      />
      <button type="submit" className="min-h-11 rounded-full bg-vinho px-4 text-sm font-semibold text-white">Salvar</button>
      <button type="button" onClick={onDone} className="min-h-11 px-2 text-sm font-semibold text-vinho">Cancelar</button>
      {error && <span role="alert" className="text-sm font-semibold text-vinho">{error}</span>}
    </form>
  );
}

/* ---------- Atalhos ---------- */

const ICON: Record<string, ReactNode> = {
  esteira: <path d="M3 6h5v12H3zM10 6h5v8h-5zM17 6h4v5h-4z" />,
  briefing: <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5" />,
  novo: <path d="M12 5v14M5 12h14" />,
  clientes: <path d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.5a3.5 3.5 0 010 6.6M18.5 14.8c1.7.8 2.8 2.6 3 5.2" />,
  datas: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />,
};

function ActionIcon({ name }: { name: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      {ICON[name]}
    </svg>
  );
}

const actionClass =
  "flex min-h-[64px] w-full items-center gap-3 rounded-peca bg-white px-4 text-left text-[15px] font-bold text-vinho shadow-[0_1px_0_var(--color-linha)] transition-transform hover:-translate-y-0.5";

/** Botão que abre a lista de clientes e leva para a página escolhida. */
function ClientAction({ label, icon, clients, to, tone = "white" }: { label: string; icon: string; clients: Row[]; to: (slug: string) => string; tone?: "white" | "vinho" }) {
  return (
    <details className="group relative">
      <summary
        className={`${actionClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden ${tone === "vinho" ? "bg-vinho! text-white!" : ""}`}
      >
        <ActionIcon name={icon} />
        <span className="flex-1">{label}</span>
        <svg width="12" height="12" viewBox="0 0 10 10" aria-hidden="true" className="transition-transform group-open:rotate-180">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </summary>
      <ul className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 flex flex-col rounded-2xl border border-linha bg-white p-2 shadow-[0_12px_32px_rgba(92,15,49,0.18)]">
        <li className="px-3 pb-1 pt-1.5 text-xs font-semibold text-texto-2">Para qual cliente?</li>
        {clients.map((c) => (
          <li key={c._id}>
            <Link href={to(c.slug)} className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[15px] font-semibold hover:bg-creme">
              <Avatar name={c.name} color={c.accentColor} url={c.photoUrl} size={28} />
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

/* ---------- Blocos ---------- */

function SectionTitle({ id, children, aside }: { id?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-[26px] font-extrabold tracking-[-0.045em] md:text-[30px]">{children}</h2>
      {aside}
    </div>
  );
}

function ClientDot({ c }: { c: { name: string; accentColor: string } }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-texto-3">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: c.accentColor }} />
      {c.name}
    </span>
  );
}

function LateList({ items, onOpen }: { items: Home["late"]; onOpen: (o: Open) => void }) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-3 rounded-peca bg-white px-5 py-6 text-base text-texto-2">
        <Asterisk size={22} color="var(--color-rosa)" /> Nada atrasado. Tudo que passou da data foi postado.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((c, i) => {
        const ready = c.status === "aprovado" || c.status === "agendado";
        return (
          <li key={c._id} className="flex items-center gap-3.5 rounded-peca border-l-4 border-st-ajuste bg-white p-3">
            <button type="button" onClick={() => onOpen({ id: c._id, slug: c.client.slug })} aria-label={`Abrir a ficha de ${c.title}`} className="shrink-0">
              <Thumb url={c.coverUrl} tone={i} className="h-[70px] w-14 rounded-lg" />
            </button>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <ClientDot c={c.client} />
              <button type="button" onClick={() => onOpen({ id: c._id, slug: c.client.slug })} className="w-full min-w-0 truncate text-left text-[15px] font-bold leading-tight hover:underline">
                {c.title}
              </button>
              <span className="text-xs font-semibold text-st-ajuste-texto">
                {shortDate(c.date)}, {c.daysLate === 1 ? "1 dia de atraso" : `${c.daysLate} dias de atraso`}
                {ready ? ". Já saiu? Marque como postado" : ""}
              </span>
            </span>
            <span className="flex flex-col items-end gap-1.5">
              <StatusMenu contentId={c._id} status={c.status} editable short className="text-[11px]" />
              <TrashButton contentId={c._id} title={c.title} editable className="size-7 border border-linha" />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export type Inbox = FunctionReturnType<typeof api.dashboard.studioInbox>;

function InboxList({ items, onOpen }: { items: Inbox; onOpen: (o: Open) => void }) {
  if (items.length === 0) {
    return <p className="rounded-peca bg-white px-5 py-6 text-base text-texto-2">Nenhum ajuste pedido, briefing ou ideia nova. Bom momento para produzir.</p>;
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i}>
          <Link
            href={
              item.contentId
                ? `/w/${item.clientSlug}/c/${item.contentId}`
                : item.briefingId
                  ? `/w/${item.clientSlug}/briefing/${item.briefingId}`
                  : item.kind === "pautas"
                    ? `/w/${item.clientSlug}/ideias`
                    : `/w/${item.clientSlug}/ideias?ver=referencias`
            }
            onClick={(e) => {
              if (!item.contentId) return;
              e.preventDefault();
              onOpen({ id: item.contentId as Id<"contents">, slug: item.clientSlug });
            }}
            className="flex items-center gap-3.5 rounded-peca bg-white p-3 hover:bg-[#FFF6FA]"
          >
            {item.kind === "ajuste" ? (
              <Thumb url={item.coverUrl} tone={i} className="h-[70px] w-14 shrink-0 rounded-lg outline outline-2 outline-offset-2 outline-st-ajuste" />
            ) : (
              <span
                aria-hidden="true"
                className={`flex h-[70px] w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                  item.kind === "briefing" ? "bg-vinho text-white" : item.kind === "pautas" ? "bg-st-agendado text-white" : "bg-rosa text-vinho"
                }`}
              >
                <span className="size-2.5 rounded-full" style={{ background: item.accentColor }} />
                {item.kind === "briefing" ? "Brief" : item.kind === "pautas" ? "Pauta" : "Ideia"}
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs font-semibold text-texto-2">
                {item.kind === "ajuste"
                  ? `${item.clientName} pediu ajuste`
                  : item.kind === "briefing"
                    ? `${item.clientName} mandou um briefing`
                    : item.kind === "pautas"
                      ? `${item.clientName} anotou no banco de pautas`
                      : item.clientName}
              </span>
              <strong className="truncate text-[15px] leading-tight">{item.title}</strong>
              {item.detail && <span className="truncate text-sm text-texto-2">{item.detail}</span>}
            </span>
            <span className="shrink-0 text-sm font-semibold text-rosa-forte">
              {item.kind === "ajuste" ? "Abrir" : item.kind === "briefing" ? "Ler" : "Ver"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function dayLabel(iso: string, today: string) {
  if (iso === today) return "Hoje";
  if (iso === addDays(today, 1)) return "Amanhã";
  return shortDate(iso).split(",")[0];
}

function Week({ items, today, onOpen }: { items: Home["week"]; today: string; onOpen: (o: Open) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7 md:gap-[1.5px] md:overflow-hidden md:rounded-peca md:bg-vinho">
      {days.map((d) => {
        const list = items.filter((c) => c.date === d);
        const isToday = d === today;
        return (
          <section
            key={d}
            aria-label={longDate(d)}
            className={`flex flex-col gap-2 rounded-peca bg-white p-3 md:min-h-[230px] md:rounded-none ${list.length === 0 ? "max-md:hidden" : ""} ${
              isToday ? "md:shadow-[inset_0_0_0_3px_var(--color-rosa)]" : ""
            }`}
          >
            <header className="flex items-baseline justify-between gap-2">
              <span className={`text-sm font-bold ${isToday ? "rounded-full bg-rosa px-2 py-0.5" : ""}`}>{dayLabel(d, today)}</span>
              <span className="text-[22px] font-extrabold leading-none tracking-[-0.04em] text-rosa">{d.slice(8)}</span>
            </header>
            {list.length === 0 ? (
              <span className="text-xs text-texto-2">Livre</span>
            ) : (
              <ul className="flex flex-col gap-2 max-md:flex-row max-md:overflow-x-auto">
                {list.map((c, i) => (
                  <li key={c._id} className="group/peca relative max-md:w-[150px] max-md:shrink-0">
                    <TrashButton contentId={c._id} title={c.title} editable reveal className="absolute -left-1 -top-1 z-10 size-6 border border-linha max-md:hidden" />
                    <button
                      type="button"
                      onClick={() => onOpen({ id: c._id, slug: c.client.slug })}
                      className="flex w-full items-start gap-2 rounded-lg p-1 text-left hover:bg-creme"
                      title={`${c.client.name}: ${c.title}`}
                    >
                      <Thumb url={c.coverUrl} tone={i} className="h-14 w-11 shrink-0 rounded-md" />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-texto-3">
                          <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: c.client.accentColor }} />
                          {c.client.name}
                        </span>
                        <span className="line-clamp-2 text-xs font-bold leading-tight">{c.title}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-texto-2">
                          <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: STATUS[c.status].color }} />
                          {STATUS[c.status].short}
                          {c.time ? `, ${c.time}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {items.length === 0 && <p className="rounded-peca bg-white px-5 py-6 text-base text-texto-2 md:hidden">Nenhuma peça nos próximos 7 dias.</p>}
    </div>
  );
}

const BAR: { key: keyof Row["counts"]; status: Status; label: string }[] = [
  { key: "publicados", status: "publicado", label: "postados" },
  { key: "aprovados", status: "aprovado", label: "aprovados" },
  { key: "aguardando", status: "aguardando", label: "aguardando" },
  { key: "ajuste", status: "ajuste", label: "em ajuste" },
  { key: "producao", status: "producao", label: "em produção" },
];

function ClientCard({ c, onOpen }: { c: Row; onOpen: (o: Open) => void }) {
  const total = Math.max(1, c.counts.total);
  return (
    <li className="flex min-w-0 flex-col gap-4 rounded-peca bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/w/${c.slug}`} className="flex items-center gap-3">
          <Avatar name={c.name} color={c.accentColor} url={c.photoUrl} size={48} />
          <span className="flex flex-col">
            <strong className="text-[19px] tracking-[-0.02em]">{c.name}</strong>
            <span className="text-[13px] text-texto-2">
              {plural(c.counts.total, "conteúdo", "conteúdos")}. {c.nextDate ? `Próximo: ${shortDate(c.nextDate)}` : "Sem próximas datas"}
            </span>
          </span>
        </Link>
        <span className="flex flex-wrap justify-end gap-1.5">
          {c.newBriefings > 0 && (
            <Link href="/estudio/esteira" className="whitespace-nowrap rounded-full bg-vinho px-2.5 py-1 text-xs font-semibold text-white">
              {plural(c.newBriefings, "briefing", "briefings")}
            </Link>
          )}
          {c.newPautas > 0 && (
            <Link href={`/w/${c.slug}/ideias`} className="whitespace-nowrap rounded-full bg-st-agendado px-2.5 py-1 text-xs font-semibold text-white">
              {c.newPautas === 1 ? "1 pauta nova" : `${c.newPautas} pautas novas`}
            </Link>
          )}
          {c.newIdeas > 0 && (
            <Link href={`/w/${c.slug}/ideias?ver=referencias`} className="whitespace-nowrap rounded-full bg-rosa px-2.5 py-1 text-xs font-semibold text-vinho">
              {c.newIdeas === 1 ? "1 ideia nova" : `${c.newIdeas} ideias novas`}
            </Link>
          )}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-creme" aria-hidden="true">
          {BAR.map((b) => {
            const n = b.key === "producao" ? c.counts.producao + c.counts.ideia : c.counts[b.key];
            return n > 0 ? <span key={b.key} style={{ width: `${(n / total) * 100}%`, background: STATUS[b.status].color }} /> : null;
          })}
        </div>
        <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs">
          {BAR.map((b) => {
            const n = b.key === "producao" ? c.counts.producao + c.counts.ideia : c.counts[b.key];
            return (
              <li key={b.key} className={`inline-flex items-center gap-1.5 ${n === 0 ? "text-texto-2" : "font-semibold"}`}>
                <span aria-hidden="true" className="size-2 rounded-full" style={{ background: STATUS[b.status].color }} />
                {n} {b.label}
              </li>
            );
          })}
        </ul>
      </div>

      {c.strip.length > 0 && (
        <ul className="flex snap-x gap-2 overflow-x-auto pb-1" aria-label={`Conteúdos de ${c.name} no mês`}>
          {c.strip.map((s, i) => (
            <li key={s._id} className="group/peca relative w-[64px] shrink-0 snap-start pt-1">
              <TrashButton contentId={s._id} title={s.title} editable reveal className="absolute -right-1 top-0 z-10 size-6 border border-linha" />
              <button type="button" onClick={() => onOpen({ id: s._id, slug: c.slug })} className="group flex w-full flex-col gap-1 text-left" title={s.title}>
                <span className="relative">
                  <Thumb url={s.coverUrl} tone={i} className="aspect-[4/5] w-full rounded-lg transition-transform duration-150 group-hover:-rotate-2" />
                  <span aria-hidden="true" className="absolute bottom-1 right-1 size-2.5 rounded-full ring-2 ring-white" style={{ background: STATUS[s.status].color }} />
                </span>
                <span className="text-[10px] text-texto-2">{shortDate(s.date).split(", ")[1]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-x-5 border-t border-linha pt-3 text-sm font-semibold text-rosa-forte">
        <Link href={`/w/${c.slug}`} className="min-h-10 content-center">Início</Link>
        <Link href={`/w/${c.slug}/calendario`} className="min-h-10 content-center">Calendário</Link>
        <Link href={`/w/${c.slug}/ideias`} className="min-h-10 content-center">Pautas</Link>
        <Link href={`/w/${c.slug}/ideias?ver=referencias`} className="min-h-10 content-center">Referências</Link>
        <Link href={`/w/${c.slug}/briefing/novo`} className="min-h-10 content-center">Briefing</Link>
      </div>
    </li>
  );
}

/* ---------- Instagram da semana ---------- */

function InstagramWeek({ today }: { today: string }) {
  const rows = useQuery(api.instagram.weekSummary, { from: addDays(today, -6), to: today });
  if (!rows || rows.length === 0) return null;
  const nf = (n: number | null) => (n === null ? "–" : n.toLocaleString("pt-BR"));
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle aside={<span className="text-sm text-texto-2">últimos 7 dias</span>}>Instagram da semana</SectionTitle>
      <ul className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => {
          const d = r.previous.reach ? (r.current.reach - r.previous.reach) / r.previous.reach : null;
          return (
            <li key={r.slug}>
              <Link href={`/w/${r.slug}/relatorio`} className="flex items-center gap-4 rounded-peca bg-white p-4 hover:bg-[#FFF6FA]">
                <span className="h-[72px] w-14 shrink-0 overflow-hidden rounded-lg bg-thumb">
                  {r.best?.thumbnailUrl && <img src={r.best.thumbnailUrl} alt="" className="size-full object-cover" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <ClientDot c={r} />
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <strong className="text-2xl font-extrabold tracking-[-0.04em]">{nf(r.current.reach)}</strong>
                    <span className="text-sm text-texto-2">de alcance, {r.current.posts} {r.current.posts === 1 ? "post" : "posts"}</span>
                  </span>
                  <span className="truncate text-xs text-texto-2">
                    {d === null ? "sem semana anterior para comparar" : `${d >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(d * 100))}% vs. semana anterior`}
                    {r.best?.caption ? `. Destaque: ${r.best.caption.split("\n")[0]}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-rosa-forte">Relatório</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- Página ---------- */

export function StudioHome({ home, clients, inbox, greeting, time, today }: { home: Home; clients: Row[]; inbox: Inbox; greeting: string; time: string; today: string }) {
  const month = today.slice(0, 7);
  const [open, setOpen] = useState<Open>(null);
  const [editingName, setEditingName] = useState(false);
  const { counts } = home;
  const firstName = (home.me.name ?? "").split(" ")[0];

  const summary = [
    counts.late > 0 ? plural(counts.late, "atrasado", "atrasados") : null,
    counts.today > 0 ? `${plural(counts.today, "peça", "peças")} hoje` : "Nada marcado para hoje",
    counts.aguardando > 0 ? `${counts.aguardando} esperando cliente` : null,
  ].filter(Boolean);

  const tiles = [
    { n: counts.late, label: "Atrasados", href: "#atrasados", alert: counts.late > 0 },
    { n: counts.today, label: "Hoje", href: "#semana" },
    { n: counts.week, label: "Próximos 7 dias", href: "#semana" },
    { n: counts.aguardando, label: "Com a cliente", href: "/estudio/esteira" },
    { n: counts.ajuste, label: "Em ajuste", href: "#precisa", alert: counts.ajuste > 0 },
    { n: counts.postadosMes, label: `Postados em ${monthName(month).toLowerCase()}`, href: "#clientes" },
  ];

  return (
    <main className="pb-16">

      <section className="grade-rosa">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-start gap-x-5 gap-y-6 px-6 pb-16 pt-8 md:items-center md:gap-x-10 md:pb-20 md:pt-14">
          <div className="col-start-1 row-start-1 flex min-w-0 flex-col gap-5">
            <span className="text-sm font-semibold text-vinho md:text-[15px]">
              {longDate(today).charAt(0).toUpperCase() + longDate(today).slice(1)} · {time}
            </span>
            <h1 className="titulo flex flex-col text-[46px] leading-[0.9] text-white sm:text-[64px] md:text-[112px]">
              <span>{greeting},</span>
              <span className="flex items-center gap-3">
                {firstName || "você"}
                <Asterisk size={36} color="var(--color-vinho)" className="md:size-20" />
              </span>
            </h1>
          </div>
          <div className="col-start-2 row-start-1 justify-self-end pt-2 md:row-span-2 md:self-center md:pt-0">
            <Portrait me={home.me} />
          </div>
          <div className="col-span-2 md:col-span-1">
            {editingName ? (
              <NameEditor name={home.me.name ?? ""} onDone={() => setEditingName(false)} />
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <SelectionBox className="ml-1.5 self-start px-3.5 py-2.5 text-base leading-snug md:text-xl">{summary.join(". ")}.</SelectionBox>
                <button type="button" onClick={() => setEditingName(true)} className="min-h-11 text-sm font-semibold text-vinho underline-offset-4 hover:underline">
                  {home.me.name ? "Mudar meu nome" : "Como quer ser chamada?"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto -mt-8 flex max-w-6xl flex-col gap-12 px-6">
        <nav aria-label="Atalhos" className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
          <Link href="/estudio/esteira" className={`${actionClass} col-span-2 bg-vinho! text-white! lg:col-span-1`}>
            <ActionIcon name="esteira" /> Abrir a esteira
          </Link>
          <ClientAction label="Novo briefing" icon="briefing" clients={clients} to={(s) => `/w/${s}/briefing/novo`} />
          <ClientAction label="Novo conteúdo" icon="novo" clients={clients} to={(s) => `/w/${s}/novo`} />
          <Link href="/estudio/clientes" className={actionClass}>
            <ActionIcon name="clientes" /> Clientes e acessos
          </Link>
          <Link href="/estudio/datas" className={actionClass}>
            <ActionIcon name="datas" /> Biblioteca de datas
          </Link>
        </nav>

        <section aria-label="Números" className="grid grid-cols-3 border-y border-linha md:grid-cols-6">
          {tiles.map((t, i) => (
            <a
              key={t.label}
              href={t.href}
              className={`flex flex-col gap-1 py-4 pr-2 hover:bg-white/60 md:py-5 md:pl-3 ${i % 3 !== 0 ? "max-md:pl-3" : ""} ${i > 2 ? "max-md:border-t max-md:border-linha" : ""} ${
                i > 0 ? "md:border-l md:border-linha" : ""
              }`}
            >
              <span className={`text-[34px] font-extrabold leading-none tracking-[-0.04em] md:text-5xl ${t.alert ? "text-st-ajuste-texto" : ""}`}>{t.n}</span>
              <span className="text-xs font-semibold text-texto-3 md:text-sm">{t.label}</span>
            </a>
          ))}
        </section>

        <div className="grid gap-12 md:grid-cols-2 md:gap-8">
          <section id="atrasados" className="flex min-w-0 scroll-mt-6 flex-col gap-4">
            <SectionTitle aside={counts.late > 0 ? <span className="text-sm font-semibold text-st-ajuste-texto">{counts.late}</span> : null}>Atrasados</SectionTitle>
            <LateList items={home.late} onOpen={setOpen} />
          </section>
          <section id="precisa" className="flex min-w-0 scroll-mt-6 flex-col gap-4">
            <SectionTitle aside={inbox.length > 0 ? <span className="text-sm font-semibold text-texto-2">{inbox.length}</span> : null}>Precisa de você</SectionTitle>
            <InboxList items={inbox} onOpen={setOpen} />
          </section>
        </div>

        <InstagramWeek today={today} />

        <section id="semana" className="flex scroll-mt-6 flex-col gap-4">
          <SectionTitle aside={<Link href="/estudio/esteira" className="min-h-11 content-center text-[15px] font-semibold text-rosa-forte">Ver na esteira</Link>}>
            Sua semana
          </SectionTitle>
          <Week items={home.week} today={today} onOpen={setOpen} />
        </section>

        <section id="clientes" className="flex scroll-mt-6 flex-col gap-4">
          <SectionTitle aside={<Link href="/estudio/clientes" className="min-h-11 content-center text-[15px] font-semibold text-rosa-forte">Gerenciar</Link>}>
            {monthName(month)} por cliente
          </SectionTitle>
          <ul className="grid gap-4 md:grid-cols-2">
            {clients.map((c) => (
              <ClientCard key={c._id} c={c} onOpen={setOpen} />
            ))}
          </ul>
        </section>
      </div>

      {open && <PieceDrawer key={open.id} contentId={open.id} slug={open.slug} onClose={() => setOpen(null)} />}
    </main>
  );
}

