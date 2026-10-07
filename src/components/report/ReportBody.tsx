"use client";

import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { addDays, shortDate, stamp } from "@/lib/dates";

type Report = FunctionReturnType<typeof api.instagram.report>;
export type FullReport = Extract<Report, { totals: unknown }>;
type Full = FullReport;

const nf = (n: number | null | undefined) => (n === null || n === undefined ? "–" : n.toLocaleString("pt-BR"));
const pct = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/* (datas ficam na página) */
/** Segunda-feira da semana de uma data. */
export function monday(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return addDays(iso, d === 0 ? -6 : 1 - d);
}

export function lastDay(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-xs text-texto-2">sem base anterior</span>;
  const d = (now - before) / before;
  const up = d >= 0;
  return (
    <span className={`text-xs font-bold ${up ? "text-st-agendado" : "text-st-ajuste-texto"}`}>
      {up ? "▲" : "▼"} {pct(Math.abs(d))} <span className="font-normal text-texto-2">vs. anterior</span>
    </span>
  );
}

/** Frases de leitura geradas a partir dos números. */
function reading(r: Full, label: string) {
  const out: string[] = [];
  const { totals: t, previous: p } = r;
  if (t.posts === 0) return [`Nenhum post publicado ${label}.`];
  out.push(`${t.posts} ${t.posts === 1 ? "publicação" : "publicações"} ${label}, com ${nf(t.reach)} contas alcançadas.`);
  if (p.reach) {
    const d = (t.reach - p.reach) / p.reach;
    out.push(`O alcance ${d >= 0 ? "subiu" : "caiu"} ${pct(Math.abs(d))} em relação ao período anterior.`);
  }
  const best = r.formats[0];
  if (r.formats.length > 1 && best) out.push(`${best.format} foi o formato que mais alcançou (${nf(best.reach)}).`);
  const top = r.top[0];
  if (top) out.push(`Destaque: ${top.caption ? `"${top.caption.split("\n")[0].slice(0, 70)}"` : "o post do dia " + shortDate(top.date)}, com ${nf(top.reach)} de alcance e ${nf(top.saved)} salvamentos.`);
  if (r.followers.gained !== null) out.push(`${r.followers.gained >= 0 ? "Ganhou" : "Perdeu"} ${nf(Math.abs(r.followers.gained))} seguidores no período.`);
  return out;
}

function Tile({ label, now, before, hint, display }: { label: string; now: number; before?: number; hint?: string; display?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-peca bg-white p-4">
      <span className="text-sm font-semibold text-texto-3">{label}</span>
      <span className="text-[32px] font-extrabold leading-none tracking-[-0.04em]">{display ?? nf(now)}</span>
      {before !== undefined ? <Delta now={now} before={before} /> : hint ? <span className="text-xs text-texto-2">{hint}</span> : null}
    </div>
  );
}

export function Body({ r, label }: { r: Full; label: string }) {
  const lines = reading(r, label);
  const maxReach = Math.max(1, ...r.formats.map((f) => f.reach));
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 text-sm text-texto-2">
        <span className="font-bold text-vinho">@{r.account.username}</span>
        {r.account.lastSyncAt && <span>Atualizado {stamp(r.account.lastSyncAt)}</span>}
        {r.account.lastError && <span className="font-semibold text-st-ajuste-texto">Última busca falhou: {r.account.lastError}</span>}
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Alcance" now={r.totals.reach} before={r.previous.reach} />
        <Tile label="Visualizações" now={r.totals.views} before={r.previous.views} />
        <Tile label="Interações" now={r.totals.interactions} before={r.previous.interactions} />
        <Tile
          label="Seguidores"
          now={r.followers.end ?? 0}
          hint={r.followers.gained !== null ? `${r.followers.gained >= 0 ? "+" : ""}${nf(r.followers.gained)} no período` : "acompanhando a partir de hoje"}
        />
        <Tile label="Salvamentos" now={r.totals.saved} before={r.previous.saved} />
        <Tile label="Compartilhamentos" now={r.totals.shares} before={r.previous.shares} />
        <Tile label="Publicações" now={r.totals.posts} before={r.previous.posts} />
        <Tile
          label="Engajamento"
          now={r.totals.engagement}
          display={pct(r.totals.engagement)}
          hint={r.previous.engagement ? `antes: ${pct(r.previous.engagement)}` : "interações / alcance"}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-peca bg-vinho p-5 text-white md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold tracking-[-0.03em]">Leitura do período</h2>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(lines.join("\n")).then(() => setCopied(true))}
            className="min-h-9 rounded-full bg-rosa px-4 text-[13px] font-bold text-vinho"
          >
            {copied ? "Copiado" : "Copiar texto"}
          </button>
        </div>
        <ul className="flex flex-col gap-1.5 text-[15px] leading-relaxed">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      {r.top.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[26px] font-extrabold tracking-[-0.045em]">Melhores conteúdos</h2>
          <ol className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            {r.top.map((p, i) => (
              <li key={p._id} className="relative flex w-[68vw] max-w-[280px] shrink-0 snap-start flex-col gap-3 rounded-peca bg-white p-3 md:w-auto md:max-w-none">
                {i === 0 && <span className="absolute left-5 top-5 z-10 -rotate-3 rounded-full bg-vinho px-3 py-1 text-xs font-bold text-white shadow">mais engajou</span>}
                <a href={p.permalink ?? "#"} target="_blank" rel="noreferrer" className="block aspect-[4/5] overflow-hidden rounded-xl bg-thumb">
                  {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-sm text-texto-2">{p.format}</span>}
                </a>
                <span className="text-xs font-semibold text-texto-2">{p.format}, {shortDate(p.date)}</span>
                {p.caption && <span className="line-clamp-2 text-sm font-semibold">{p.caption}</span>}
                <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[
                    ["Alcance", p.reach],
                    ["Salvos", p.saved],
                    ["Compart.", p.shares],
                  ].map(([k, n]) => (
                    <div key={k as string} className="rounded-lg bg-creme px-1 py-2">
                      <dt className="text-texto-2">{k}</dt>
                      <dd className="text-base font-extrabold">{nf(n as number | null)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ol>
        </section>
      )}

      {r.formats.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[26px] font-extrabold tracking-[-0.045em]">Por formato</h2>
          <ul className="flex flex-col gap-2.5 rounded-peca bg-white p-5">
            {r.formats.map((f) => (
              <li key={f.format} className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-sm md:grid-cols-[90px_minmax(0,1fr)_auto]">
                <span className="font-bold">{f.format}</span>
                <span className="h-3 overflow-hidden rounded-full bg-creme">
                  <span className="block h-full rounded-full bg-rosa-forte" style={{ width: `${(f.reach / maxReach) * 100}%` }} />
                </span>
                <span className="col-start-2 text-xs text-texto-2 md:col-start-auto md:text-sm">
                  {nf(f.reach)} alcance, {f.posts} {f.posts === 1 ? "post" : "posts"}, {pct(f.engagement)} engaj.
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-[26px] font-extrabold tracking-[-0.045em]">Todas as publicações</h2>
        {r.posts.length === 0 ? (
          <p className="text-texto-2">Nenhuma publicação no período.</p>
        ) : (
          <div className="overflow-x-auto rounded-peca bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-texto-2">
                <tr>
                  <th className="px-4 py-3 font-semibold">Post</th>
                  <th className="px-2 py-3 font-semibold">Alcance</th>
                  <th className="px-2 py-3 font-semibold">Views</th>
                  <th className="px-2 py-3 font-semibold">Curtidas</th>
                  <th className="px-2 py-3 font-semibold">Coment.</th>
                  <th className="px-2 py-3 font-semibold">Salvos</th>
                  <th className="px-2 py-3 font-semibold">Compart.</th>
                </tr>
              </thead>
              <tbody>
                {r.posts.map((p) => (
                  <tr key={p._id} className="border-t border-linha">
                    <td className="px-4 py-2.5">
                      <a href={p.permalink ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-3">
                        <span className="h-12 w-10 shrink-0 overflow-hidden rounded-md bg-thumb">
                          {p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="size-full object-cover" />}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="text-xs text-texto-2">{p.format}, {shortDate(p.date)}</span>
                          <span className="max-w-[260px] truncate font-semibold">{p.caption?.split("\n")[0] ?? "Sem legenda"}</span>
                        </span>
                      </a>
                    </td>
                    <td className="px-2 font-bold">{nf(p.reach)}</td>
                    <td className="px-2">{nf(p.views)}</td>
                    <td className="px-2">{nf(p.likes)}</td>
                    <td className="px-2">{nf(p.comments)}</td>
                    <td className="px-2">{nf(p.saved)}</td>
                    <td className="px-2">{nf(p.shares)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
