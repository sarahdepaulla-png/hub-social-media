"use client";

import { addDays, shortDate, todayISO } from "@/lib/dates";

const OWNER_COLORS = ["#C2186B", "#0F7A6E", "#8A63D2", "#F0A030", "#5C0F31", "#2B6CB0"];
const FIXED: Record<string, string> = { Sarita: "#C2186B", Mai: "#0F7A6E", Leo: "#8A63D2" };

export function ownerColor(name: string) {
  if (FIXED[name]) return FIXED[name];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return OWNER_COLORS[h % OWNER_COLORS.length];
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** Texto e cor do prazo em relação a hoje. */
export function dueInfo(due: string, today = todayISO()) {
  const d = daysBetween(today, due);
  if (d < 0) return { label: `Atrasado ${-d} ${d === -1 ? "dia" : "dias"}`, tone: "late" as const };
  if (d === 0) return { label: "Prazo hoje", tone: "soon" as const };
  if (d === 1) return { label: "Prazo amanhã", tone: "soon" as const };
  if (due <= addDays(today, 3)) return { label: `Prazo ${shortDate(due)}`, tone: "soon" as const };
  return { label: `Prazo ${shortDate(due)}`, tone: "ok" as const };
}

const TONE = {
  late: "bg-st-ajuste text-white",
  soon: "bg-st-aguardando text-white",
  ok: "border border-campo bg-white text-texto-3",
};

export function DueBadge({ due, done = false }: { due: string | null | undefined; done?: boolean }) {
  if (!due) return null;
  if (done) return <span className="rounded-full border border-campo bg-white px-2 py-0.5 text-[11px] font-semibold text-texto-2">Prazo {shortDate(due)}</span>;
  const { label, tone } = dueInfo(due);
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE[tone]}`}>{label}</span>;
}

export function OwnerBadge({ owner }: { owner: string | null | undefined }) {
  if (!owner) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-texto-3" title={`Com ${owner}`}>
      <span aria-hidden="true" className="flex size-[18px] items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: ownerColor(owner) }}>
        {owner.charAt(0).toUpperCase()}
      </span>
      {owner}
    </span>
  );
}

const field = "min-h-12 w-full border-[1.5px] border-campo bg-white px-3 text-base font-normal text-vinho";

/** Campos "Com quem está" e "Prazo" para formulários (nomes owner e dueDate). */
export function TaskFields({ team, owner, dueDate, id = "tarefa" }: { team: string[]; owner?: string | null; dueDate?: string | null; id?: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl bg-[#FFF6FA] p-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Com quem está
        <input name="owner" list={`${id}-equipe`} defaultValue={owner ?? ""} placeholder="Sarita, Mai, Leo" autoComplete="off" className={field} />
        <datalist id={`${id}-equipe`}>
          {team.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Prazo de entrega
        <input name="dueDate" type="date" defaultValue={dueDate ?? ""} className={field} />
      </label>
      <p className="text-xs text-texto-2 sm:col-span-2">Só o estúdio vê. Aparece na esteira.</p>
    </div>
  );
}
