"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Suspense, useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { Asterisk, Loading, Thumb } from "@/components/brand";
import { useWorkspace } from "@/components/WorkspaceShell";
import { StatusMenu } from "@/components/StatusMenu";
import { errorText } from "@/components/content/DecisionSheet";
import { currentMonth, longDate, monthGrid, monthName, shiftMonth, todayISO } from "@/lib/dates";
import { FORMAT, PLATFORM, STATUS, type Format, type Platform, type Status } from "@/lib/labels";

const WEEK_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEK_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const selectClass = "min-h-10 rounded-full border border-campo bg-white pl-3.5 pr-8 text-sm text-vinho";

type Card = FunctionReturnType<typeof api.calendar.month>["contents"][number];
type Opp = FunctionReturnType<typeof api.calendar.month>["opportunities"][number];

/** Uma peça na agenda do celular, com "Mudar dia" para a admin. */
function PieceRow({ item, tone, base, admin, onMove }: { item: Card; tone: number; base: string; admin: boolean; onMove: (id: string, day: string) => void }) {
  return (
    <div className="flex gap-3.5">
      <Link href={`${base}/c/${item._id}`} className="shrink-0">
        <Thumb url={item.coverUrl} tone={tone} label={item.coverUrl ? undefined : FORMAT[item.format]} className="h-[100px] w-20 rounded-lg" />
      </Link>
      <span className="flex min-w-0 flex-col gap-1.5 pt-0.5">
        <Link href={`${base}/c/${item._id}`} className="text-base font-bold leading-tight">
          {item.title}
        </Link>
        <span className="text-[13px] text-texto-2">
          {PLATFORM[item.platform]}, {FORMAT[item.format].toLowerCase()}
          {item.time ? `, ${item.time}` : ""}
        </span>
        <StatusMenu contentId={item._id} status={item.status} editable={admin} />
        {admin && (
          <label className="inline-flex items-center gap-2 text-[13px] font-semibold text-rosa-forte">
            Mudar dia
            <input
              type="date"
              defaultValue={item.date}
              onChange={(e) => e.target.value && e.target.value !== item.date && onMove(item._id, e.target.value)}
              className="min-h-9 rounded-md border border-campo bg-white px-2 text-[13px] font-normal text-vinho"
            />
          </label>
        )}
      </span>
    </div>
  );
}

/** Lista do mês no celular: todos os dias com peças ou datas do nicho. */
function MonthList({
  days,
  byDay,
  oppsByDay,
  accent,
  base,
  admin,
  today,
  onMove,
}: {
  days: string[];
  byDay: Map<string, Card[]>;
  oppsByDay: Map<string, Opp[]>;
  accent: string;
  base: string;
  admin: boolean;
  today: string;
  onMove: (id: string, day: string) => void;
}) {
  if (days.length === 0) return <p className="px-2 text-[15px] text-texto-2">Nada programado neste mês.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {days.map((day) => (
        <li key={day} className={`flex flex-col gap-3 rounded-peca bg-white p-4 ${day === today ? "shadow-[inset_0_0_0_3px_var(--color-rosa)]" : ""}`}>
          <h2 className="flex items-baseline gap-2">
            <span className="text-[30px] font-extrabold leading-none tracking-[-0.05em]">{day.slice(8)}</span>
            <span className="text-sm capitalize text-texto-2">{longDate(day).split(",")[0]}</span>
            {day === today && <span className="rounded-full bg-rosa px-2 text-xs font-bold">hoje</span>}
          </h2>
          {(oppsByDay.get(day) ?? []).map((o) => (
            <span key={o._id} className="self-start -rotate-1 rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: accent }}>
              {o.title}
            </span>
          ))}
          {(byDay.get(day) ?? []).map((c, i) => (
            <PieceRow key={c._id} item={c} tone={i + Number(day.slice(8))} base={base} admin={admin} onMove={onMove} />
          ))}
        </li>
      ))}
    </ol>
  );
}

function CalendarView() {
  const ws = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const month = /^\d{4}-\d{2}$/.test(params.get("mes") ?? "") ? params.get("mes")! : currentMonth();
  const data = useQuery(api.calendar.month, { slug: ws.slug, month });
  const update = useMutation(api.contents.update);
  const [platform, setPlatform] = useState<Platform | "">("");
  const [format, setFormat] = useState<Format | "">("");
  const [status, setStatus] = useState<Status | "">("");
  const today = todayISO();
  const [selected, setSelected] = useState<string>(today.startsWith(month) ? today : `${month}-01`);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"mes" | "lista">("mes");
  const admin = ws.viewerRole === "admin";
  const base = `/w/${ws.slug}`;

  const filtered = useMemo(
    () =>
      (data?.contents ?? []).filter(
        (c) => (!platform || c.platform === platform) && (!format || c.format === format) && (!status || c.status === status),
      ),
    [data, platform, format, status],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const c of filtered) m.set(c.date, [...(m.get(c.date) ?? []), c]);
    return m;
  }, [filtered]);
  const oppsByDay = useMemo(() => {
    const m = new Map<string, NonNullable<typeof data>["opportunities"]>();
    for (const o of data?.opportunities ?? []) if (!o.allMonth) m.set(o.date, [...(m.get(o.date) ?? []), o]);
    return m;
  }, [data]);

  const go = (delta: number) => {
    const next = shiftMonth(month, delta);
    router.replace(`${base}/calendario?mes=${next}`, { scroll: false });
    setSelected(today.startsWith(next) ? today : `${next}-01`);
  };

  /** Reagendar pelo celular (no computador também dá para arrastar). */
  const moveTo = async (contentId: string, day: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    try {
      await update({ contentId: contentId as Id<"contents">, date: day });
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const drop = async (day: string) => {
    setOverDay(null);
    if (!dragId) return;
    const item = filtered.find((c) => c._id === dragId);
    setDragId(null);
    if (!item || item.date === day) return;
    try {
      await update({ contentId: item._id as Id<"contents">, date: day });
    } catch (err) {
      setError(errorText(err));
    }
  };

  const cells = monthGrid(month);
  const filtersOn = !!(platform || format || status);
  const monthOpps = (data?.opportunities ?? []).filter((o) => o.allMonth);
  const dayItems = byDay.get(selected) ?? [];
  const dayOpps = oppsByDay.get(selected) ?? [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pb-12 pt-2 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 px-2 md:px-0">
        <h1 className="titulo flex items-baseline gap-3 text-5xl md:text-8xl">
          {monthName(month)} <span className="text-rosa">{month.slice(0, 4)}</span>
        </h1>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Mês anterior" onClick={() => go(-1)} className="flex size-11 items-center justify-center rounded-full hover:bg-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          {month !== currentMonth() && (
            <button type="button" onClick={() => { router.replace(`${base}/calendario`, { scroll: false }); setSelected(today); }} className="min-h-11 px-2 text-sm font-semibold text-rosa-forte">
              Hoje
            </button>
          )}
          <button type="button" aria-label="Próximo mês" onClick={() => go(1)} className="flex size-11 items-center justify-center rounded-full hover:bg-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
          {admin && (
            <Link href={`${base}/novo?data=${selected}`} className="ml-2 inline-flex min-h-11 items-center rounded-full bg-vinho px-4 text-sm font-semibold text-white md:px-5">
              <span className="md:hidden">Novo</span>
              <span className="hidden md:inline">Novo conteúdo</span>
            </Link>
          )}
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto px-2 pb-1 md:px-0" role="group" aria-label="Filtros">
        <label className="sr-only" htmlFor="f-plat">Plataforma</label>
        <select id="f-plat" value={platform} onChange={(e) => setPlatform(e.target.value as Platform | "")} className={selectClass}>
          <option value="">Plataforma: todas</option>
          {Object.entries(PLATFORM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-form">Formato</label>
        <select id="f-form" value={format} onChange={(e) => setFormat(e.target.value as Format | "")} className={selectClass}>
          <option value="">Formato: todos</option>
          {Object.entries(FORMAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-stat">Status</label>
        <select id="f-stat" value={status} onChange={(e) => setStatus(e.target.value as Status | "")} className={selectClass}>
          <option value="">Status: todos</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {filtersOn && (
          <button type="button" onClick={() => { setPlatform(""); setFormat(""); setStatus(""); }} className="min-h-10 shrink-0 px-2 text-sm font-semibold text-rosa-forte">
            Limpar
          </button>
        )}
      </div>

      {monthOpps.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 px-2 text-sm md:px-0">
          <span className="text-texto-2">O mês todo:</span>
          {monthOpps.map((o) => (
            <span key={o._id} className="-rotate-2 rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: ws.accentColor }}>
              {o.title}
            </span>
          ))}
        </p>
      )}
      {error && <p role="alert" className="px-2 text-sm font-semibold text-st-ajuste-texto">{error}</p>}

      {data === undefined ? (
        <Loading />
      ) : (
        <>
          {/* Celular: mês em grade (com agenda do dia) ou lista completa do mês */}
          <div className="md:hidden">
            <div role="group" aria-label="Modo de ver" className="mb-4 grid grid-cols-2 rounded-full bg-white p-1">
              {(["mes", "lista"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`min-h-10 rounded-full text-sm font-semibold ${view === v ? "bg-vinho text-white" : "text-texto-3"}`}
                >
                  {v === "mes" ? "Mês" : "Lista do mês"}
                </button>
              ))}
            </div>

            {view === "lista" ? (
              <MonthList
                days={cells.filter((d): d is string => !!d && (byDay.has(d) || oppsByDay.has(d)))}
                byDay={byDay}
                oppsByDay={oppsByDay}
                accent={ws.accentColor}
                base={base}
                admin={admin}
                today={today}
                onMove={moveTo}
              />
            ) : (
            <>
            <div className="rounded-t-md bg-white">
              <div aria-hidden="true" className="-mt-2 flex h-5 items-end justify-around px-2">
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i} className="h-4 w-1.5 rounded-t-md border-2 border-b-0 border-vinho" />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-[3px] bg-white pb-1.5 pt-1 text-center text-[11px] font-semibold text-texto-2">
              {WEEK_SHORT.map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-[3px]">
              {cells.map((day, i) => {
                if (!day) return <span key={i} />;
                const items = byDay.get(day) ?? [];
                const opp = oppsByDay.has(day);
                const sel = day === selected;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelected(day)}
                    aria-pressed={sel}
                    aria-label={`${longDate(day)}, ${items.length} ${items.length === 1 ? "conteúdo" : "conteúdos"}`}
                    className={`flex h-[78px] flex-col items-center gap-[3px] rounded-md bg-white p-[3px] ${sel ? "outline outline-2 -outline-offset-2 outline-vinho" : ""}`}
                  >
                    <span
                      className={`text-[15px] font-extrabold leading-none tracking-[-0.03em] ${day === today ? "rounded-full bg-rosa px-1.5 py-0.5" : ""}`}
                      style={opp ? { boxShadow: `inset 0 -2px 0 ${ws.accentColor}` } : undefined}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {items[0] && (
                      <>
                        <Thumb url={items[0].coverUrl} tone={Number(day.slice(8))} className="w-full flex-1 rounded-[4px]" />
                        <span className="flex gap-0.5">
                          {items.slice(0, 3).map((c) => (
                            <span key={c._id} className="size-[7px] rounded-full" style={{ background: STATUS[c.status].color }} />
                          ))}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            <section className="mt-5 flex flex-col gap-3 rounded-peca bg-white p-5">
              <h2 className="text-[22px] font-extrabold capitalize tracking-[-0.045em]">{longDate(selected)}</h2>
              {dayOpps.map((o) => (
                <span key={o._id} className="self-start -rotate-1 rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: ws.accentColor }}>
                  {o.title}
                </span>
              ))}
              {dayItems.length === 0 && <p className="text-[15px] text-texto-2">Nada programado neste dia.</p>}
              {dayItems.map((c, i) => (
                <PieceRow key={c._id} item={c} tone={i} base={base} admin={admin} onMove={moveTo} />
              ))}
              {admin && (
                <Link href={`${base}/novo?data=${selected}`} className="mt-1 min-h-11 content-center text-[15px] font-semibold text-rosa-forte">
                  Criar conteúdo neste dia
                </Link>
              )}
            </section>
            </>
            )}
          </div>

          {/* Desktop: agenda de espiral */}
          <div className="hidden md:block">
            <div className="rounded-t-md bg-white">
              <div aria-hidden="true" className="-mt-[18px] flex h-[34px] items-end justify-around px-3">
                {Array.from({ length: 28 }, (_, i) => (
                  <span key={i} className="h-[30px] w-2 rounded-t-lg border-[2.5px] border-b-0 border-vinho" />
                ))}
              </div>
              <div className="grid grid-cols-7 border-b-[1.5px] border-vinho pb-2.5 pt-3.5 text-center text-[15px] font-semibold">
                {WEEK_LONG.map((d) => <span key={d}>{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-[1.5px] bg-vinho">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} className="min-h-[150px] bg-[#FBF3F6]" />;
                  const items = byDay.get(day) ?? [];
                  const opps = oppsByDay.get(day) ?? [];
                  const past = day < today;
                  return (
                    <div
                      key={day}
                      onDragOver={admin ? (e) => { e.preventDefault(); setOverDay(day); } : undefined}
                      onDragLeave={admin ? () => setOverDay((d) => (d === day ? null : d)) : undefined}
                      onDrop={admin ? () => drop(day) : undefined}
                      className={`group relative flex min-h-[150px] flex-col gap-2 bg-white p-2.5 ${overDay === day ? "bg-[#FFE3F1]" : ""} ${
                        day === today ? "shadow-[inset_0_0_0_3px_var(--color-rosa)]" : ""
                      }`}
                    >
                      <span className="flex items-baseline justify-between">
                        <span className={`text-[26px] font-extrabold leading-none tracking-[-0.04em] ${past ? "text-rosa" : ""}`}>{day.slice(8)}</span>
                        {admin && (
                          <Link
                            href={`${base}/novo?data=${day}`}
                            aria-label={`Criar conteúdo em ${longDate(day)}`}
                            className="flex size-7 items-center justify-center rounded-full text-lg text-texto-2 opacity-0 hover:bg-creme focus:opacity-100 group-hover:opacity-100"
                          >
                            +
                          </Link>
                        )}
                      </span>
                      {items.map((c, j) => (
                        <div
                          key={c._id}
                          draggable={admin}
                          onDragStart={() => setDragId(c._id)}
                          onDragEnd={() => setDragId(null)}
                          className={`flex items-start gap-2 ${dragId === c._id ? "opacity-40" : ""} ${admin ? "cursor-grab" : ""}`}
                        >
                          <Link href={`${base}/c/${c._id}`} draggable={false} className="shrink-0">
                            <Thumb
                              url={c.coverUrl}
                              tone={j + Number(day.slice(8))}
                              className={`h-[72px] w-[58px] shrink-0 rounded-lg ${c.status === "aprovado" ? "outline outline-2 outline-offset-2 outline-rosa-forte" : ""}`}
                            />
                          </Link>
                          <span className="flex min-w-0 flex-col gap-1">
                            <Link href={`${base}/c/${c._id}`} draggable={false} className="flex flex-col gap-1">
                              <span className="line-clamp-2 text-xs font-semibold leading-tight">{c.title}</span>
                              <span className="text-[11px] text-texto-2">{FORMAT[c.format]}</span>
                            </Link>
                            <StatusMenu contentId={c._id} status={c.status} editable={admin} short className="text-[11px]" />
                          </span>
                        </div>
                      ))}
                      {opps.map((o) => (
                        <span
                          key={o._id}
                          className="-rotate-2 self-start rounded-full px-2.5 py-1 text-[11px] font-semibold leading-tight text-white"
                          style={{ background: ws.accentColor }}
                        >
                          {o.title}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
            {admin && <p className="mt-3 text-sm text-texto-2">Arraste uma peça para outro dia para reagendar. Passe o mouse num dia e use + para criar.</p>}
          </div>

          {filtered.length === 0 && (
            <div className="flex items-center gap-3 px-2 text-texto-2">
              <Asterisk size={22} color="var(--color-rosa)" />
              {filtersOn ? "Nenhuma peça com esses filtros neste mês." : "Nenhum conteúdo neste mês ainda."}
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default function CalendarioPage() {
  return (
    <Suspense>
      <CalendarView />
    </Suspense>
  );
}
