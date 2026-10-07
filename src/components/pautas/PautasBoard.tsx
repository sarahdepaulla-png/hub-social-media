"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { Asterisk, Loading, StatusTag, buttonClass } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { currentMonth, monthName, shiftMonth, shortDate, stamp, todayISO } from "@/lib/dates";
import { PLATFORM, type Format, type Platform } from "@/lib/labels";

type Pauta = FunctionReturnType<typeof api.pautas.list>[number];
type FileRef = { id: Id<"_storage">; name: string; type: string };

/** Formatos que a cliente escolhe com um toque. */
const FORMATS: { id: Format; label: string; color: string }[] = [
  { id: "reels", label: "Reels", color: "#C2186B" },
  { id: "stories", label: "Stories", color: "#8A63D2" },
  { id: "carrossel", label: "Carrossel", color: "#0F7A6E" },
  { id: "imagem", label: "Post", color: "#F0A030" },
  { id: "video", label: "Vídeo", color: "#5C0F31" },
];
const FMT = Object.fromEntries(FORMATS.map((f) => [f.id, f])) as Record<string, (typeof FORMATS)[number]>;

const STATUS = {
  nova: { label: "Nova", color: "var(--color-st-aguardando)" },
  vista: { label: "Vista pelo estúdio", color: "var(--color-st-agendado)" },
  calendario: { label: "No calendário", color: "var(--color-st-aprovado)" },
  guardada: { label: "Guardada", color: "var(--color-st-ideia)" },
} as const;

const MAX_BYTES = 100 * 1024 * 1024;
const input = "w-full border-[1.5px] border-campo bg-white px-3 text-[15px] font-normal text-vinho";

function monthLabel(m: string | null) {
  if (!m) return "Sem pressa";
  const year = m.slice(0, 4);
  return `${monthName(m)}${year !== currentMonth().slice(0, 4) ? ` ${year}` : ""}`;
}

function monthOptions(extra: (string | null)[]) {
  const base = Array.from({ length: 6 }, (_, i) => shiftMonth(currentMonth(), i));
  return [...new Set([...base, ...extra.filter((m): m is string => !!m)])].sort();
}

/** Envia arquivos para o Convex e devolve as referências. */
function useUploader() {
  const uploadUrl = useMutation(api.ideas.generateUploadUrl);
  return async (files: File[]): Promise<FileRef[]> => {
    const out: FileRef[] = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) throw new Error(`"${file.name}" passa de 100 MB. Mande pelo link do Drive.`);
      const url = await uploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!res.ok) throw new Error(`Não deu para enviar "${file.name}".`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      out.push({ id: storageId, name: file.name.slice(0, 120), type: file.type || "application/octet-stream" });
    }
    return out;
  };
}

function FormatPicker({ value, onChange, size = "md" }: { value: Format | null; onChange: (f: Format | null) => void; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label="Formato" className="flex flex-wrap gap-1.5">
      {FORMATS.map((f) => {
        const on = value === f.id;
        return (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? null : f.id)}
            className={`rounded-full border-[1.5px] font-semibold ${size === "sm" ? "min-h-9 px-3 text-[13px]" : "min-h-10 px-3.5 text-sm"}`}
            style={on ? { background: f.color, borderColor: f.color, color: "white" } : { borderColor: "var(--color-campo)", background: "white" }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

function FormatChip({ format }: { format: string | null }) {
  const f = format ? FMT[format] : null;
  if (!f) return <span className="inline-flex min-h-7 items-center rounded-full border border-dashed border-campo px-2.5 text-xs text-texto-2">Formato?</span>;
  return (
    <span className="inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-bold text-white" style={{ background: f.color }}>
      {f.label}
    </span>
  );
}

function Thumbs({ files, max = 3, size = 40 }: { files: Pauta["files"]; max?: number; size?: number }) {
  if (files.length === 0) return null;
  return (
    <span className="flex items-center gap-1">
      {files.slice(0, max).map((f) => (
        <span key={f.id} className="overflow-hidden rounded-md bg-thumb" style={{ width: size, height: size }}>
          {f.url && f.type.startsWith("image/") ? (
            <img src={f.url} alt="" className="size-full object-cover" />
          ) : f.url && f.type.startsWith("video/") ? (
            <video src={`${f.url}#t=0.5`} muted playsInline preload="metadata" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-[10px] font-bold text-texto-2">ARQ</span>
          )}
        </span>
      ))}
      {files.length > max && <span className="text-xs font-semibold text-texto-2">+{files.length - max}</span>}
    </span>
  );
}

function AttachButton({ onFiles, busy, label = "Adicionar fotos ou vídeos" }: { onFiles: (f: File[]) => void; busy: boolean; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => ref.current?.click()}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border-[1.5px] border-vinho bg-white px-4 text-sm font-semibold text-vinho disabled:opacity-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M21 12.5l-8.5 8.5a5 5 0 01-7-7L14 5.5a3.3 3.3 0 014.7 4.7L10.2 18.7a1.7 1.7 0 01-2.4-2.4L15.5 8.6" />
        </svg>
        {busy ? "Enviando" : label}
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        accept="image/*,video/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (list.length) onFiles(list);
        }}
      />
    </>
  );
}

/* ---------- Nova pauta ---------- */

function QuickAdd({ slug, months, admin }: { slug: string; months: string[]; admin: boolean }) {
  const create = useMutation(api.pautas.create);
  const upload = useUploader();
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<Format | null>(null);
  const [month, setMonth] = useState<string>(currentMonth());
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return titleRef.current?.focus();
    setBusy(true);
    setError(null);
    try {
      const uploaded = await upload(files);
      await create({ slug, title, format: format ?? undefined, month: month || undefined, notes: notes || undefined, files: uploaded });
      setTitle("");
      setNotes("");
      setFiles([]);
      setMore(false);
      titleRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error && !("data" in err) ? err.message : errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5 rounded-peca bg-white p-4 shadow-flutua md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="sr-only" htmlFor="nova-pauta">Tema da pauta</label>
        <input
          id="nova-pauta"
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={admin ? "Nova pauta para o banco da cliente" : "Sobre o que você quer falar? Ex.: 3 erros no alongamento"}
          className={`${input} min-h-12 flex-1 text-base`}
        />
        <label className="sr-only" htmlFor="nova-pauta-mes">Para quando</label>
        <select id="nova-pauta-mes" value={month} onChange={(e) => setMonth(e.target.value)} className={`${input} min-h-12 md:w-44`}>
          {months.map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
          <option value="">Sem pressa</option>
        </select>
        <button type="submit" disabled={busy} className={`${buttonClass.primary} min-h-12 shrink-0`}>
          {busy ? "Salvando" : "Adicionar"}
        </button>
      </div>
      <FormatPicker value={format} onChange={setFormat} size="sm" />
      {more ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Como eu imagino
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder={"Gancho, o que mostrar, o que falar, como termina..."}
              className={`${input} resize-y py-2.5 leading-relaxed`}
            />
          </label>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2.5">
        {!more && (
          <button type="button" onClick={() => setMore(true)} className="min-h-10 px-1 text-sm font-semibold text-rosa-forte">
            Contar como imagino
          </button>
        )}
        <AttachButton busy={busy} label="Anexar fotos ou vídeos" onFiles={(f) => setFiles((x) => [...x, ...f].slice(0, 12))} />
        {files.map((f, i) => (
          <span key={i} className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-creme px-3 text-xs font-semibold">
            {f.name.length > 22 ? `${f.name.slice(0, 20)}…` : f.name}
            <button type="button" aria-label={`Tirar ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="text-texto-2">×</button>
          </span>
        ))}
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
    </form>
  );
}

/* ---------- Detalhe da pauta ---------- */

function ToCalendar({ pauta, onDone }: { pauta: Pauta; onDone: () => void }) {
  const toCalendar = useMutation(api.pautas.toCalendar);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultDate = pauta.month && pauta.month > todayISO().slice(0, 7) ? `${pauta.month}-01` : todayISO();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        setPending(true);
        setError(null);
        try {
          await toCalendar({ pautaId: pauta._id, date: String(d.get("date")), platform: d.get("platform") as Platform, format: d.get("format") as Format });
          onDone();
        } catch (err) {
          setError(errorText(err));
          setPending(false);
        }
      }}
      className="flex flex-col gap-3 rounded-peca bg-vinho p-4 text-white"
    >
      <strong className="text-base">Levar pro calendário</strong>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Dia
          <input name="date" type="date" required defaultValue={defaultDate} className={`${input} min-h-11`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Plataforma
          <select name="platform" defaultValue="instagram" className={`${input} min-h-11`}>
            {Object.entries(PLATFORM).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Formato
          <select name="format" defaultValue={pauta.format ?? "reels"} className={`${input} min-h-11`}>
            {FORMATS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
            <option value="link">Link externo</option>
          </select>
        </label>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-rosa">{error}</p>}
      <button type="submit" disabled={pending} className={`${buttonClass.secondary} min-h-11 self-start text-sm`}>
        {pending ? "Criando" : "Criar a peça em produção"}
      </button>
    </form>
  );
}

function PautaDetail({ pauta, admin, base, months }: { pauta: Pauta; admin: boolean; base: string; months: string[] }) {
  const update = useMutation(api.pautas.update);
  const addFiles = useMutation(api.pautas.addFiles);
  const removeFile = useMutation(api.pautas.removeFile);
  const setStatus = useMutation(api.pautas.setStatus);
  const setNote = useMutation(api.pautas.setNote);
  const remove = useMutation(api.pautas.remove);
  const upload = useUploader();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendar, setCalendar] = useState(false);
  const edit = pauta.canEdit;

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error && !("data" in err) ? err.message : errorText(err));
    }
  };

  return (
    <div className="flex flex-col gap-5 border-t border-linha px-4 pb-5 pt-4 md:px-5">
      {edit ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Tema
            <input
              defaultValue={pauta.title}
              onBlur={(e) => e.target.value.trim() !== pauta.title && run(() => update({ pautaId: pauta._id, title: e.target.value }))}
              className={`${input} min-h-11`}
            />
          </label>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex flex-col gap-1.5 text-sm font-semibold">
              Formato
              <FormatPicker value={(pauta.format as Format | null) ?? null} onChange={(f) => run(() => update({ pautaId: pauta._id, format: f }))} size="sm" />
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold md:ml-auto">
              Para quando
              <select
                value={pauta.month ?? ""}
                onChange={(e) => run(() => update({ pautaId: pauta._id, month: e.target.value || null }))}
                className={`${input} min-h-11 md:w-44`}
              >
                {months.map((m) => (
                  <option key={m} value={m}>{monthLabel(m)}</option>
                ))}
                <option value="">Sem pressa</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Como eu imagino
            <textarea
              defaultValue={pauta.notes ?? ""}
              rows={5}
              placeholder="Gancho, o que mostrar, o que falar, como termina..."
              onBlur={(e) => e.target.value !== (pauta.notes ?? "") && run(() => update({ pautaId: pauta._id, notes: e.target.value }))}
              className={`${input} resize-y py-2.5 leading-relaxed`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Link de referência (opcional)
            <input
              type="url"
              inputMode="url"
              defaultValue={pauta.link ?? ""}
              placeholder="https://"
              onBlur={(e) => e.target.value !== (pauta.link ?? "") && run(() => update({ pautaId: pauta._id, link: e.target.value }))}
              className={`${input} min-h-11`}
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pauta.notes ? <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{pauta.notes}</p> : <p className="text-sm text-texto-2">Sem descrição.</p>}
          {pauta.link && (
            <a href={pauta.link} target="_blank" rel="noreferrer" className="break-all text-sm font-semibold text-rosa-forte underline">
              {pauta.link}
            </a>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <span className="text-sm font-semibold">Anexos {pauta.files.length > 0 && <span className="font-normal text-texto-2">{pauta.files.length}</span>}</span>
        {pauta.files.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {pauta.files.map((f) => (
              <li key={f.id} className="group relative aspect-square overflow-hidden rounded-xl bg-thumb">
                <a href={f.url ?? "#"} target="_blank" rel="noreferrer" title={f.name} className="block size-full">
                  {f.url && f.type.startsWith("image/") ? (
                    <img src={f.url} alt={f.name} className="size-full object-cover" />
                  ) : f.url && f.type.startsWith("video/") ? (
                    <span className="relative block size-full">
                      <video src={`${f.url}#t=0.5`} muted playsInline preload="metadata" className="size-full object-cover" />
                      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-2xl text-white drop-shadow">▶</span>
                    </span>
                  ) : (
                    <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-[11px] font-semibold text-texto-3">
                      <span className="text-base">PDF</span>
                      <span className="line-clamp-2 break-all">{f.name}</span>
                    </span>
                  )}
                </a>
                {edit && (
                  <button
                    type="button"
                    aria-label={`Tirar ${f.name}`}
                    onClick={() => confirm(`Tirar "${f.name}" da pauta?`) && run(() => removeFile({ pautaId: pauta._id, fileId: f.id }))}
                    className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-white/95 text-sm font-bold text-st-ajuste-texto shadow md:opacity-0 md:group-hover:opacity-100"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {edit && pauta.files.length < 12 && (
          <div>
            <AttachButton
              busy={busy}
              onFiles={async (list) => {
                setBusy(true);
                await run(async () => addFiles({ pautaId: pauta._id, files: await upload(list.slice(0, 12 - pauta.files.length)) }));
                setBusy(false);
              }}
            />
          </div>
        )}
        {!edit && pauta.files.length === 0 && <span className="text-sm text-texto-2">Nenhum anexo.</span>}
      </div>

      {admin ? (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Comentário do estúdio <span className="font-normal text-texto-2">(a cliente vê)</span>
          <textarea
            defaultValue={pauta.studioNote ?? ""}
            rows={2}
            placeholder="Ex.: amei! Acho que funciona melhor como carrossel"
            onBlur={(e) => e.target.value !== (pauta.studioNote ?? "") && run(() => setNote({ pautaId: pauta._id, note: e.target.value }))}
            className={`${input} resize-y py-2.5`}
          />
        </label>
      ) : (
        pauta.studioNote && (
          <div className="rounded-xl border-l-4 border-rosa-forte bg-creme px-4 py-3 text-[15px]">
            <span className="block text-xs font-bold text-rosa-forte">Estúdio</span>
            {pauta.studioNote}
          </div>
        )
      )}

      {pauta.content && (
        <Link href={`${base}/c/${pauta.content._id}`} className="flex items-center justify-between gap-3 rounded-xl bg-creme px-4 py-3 text-sm">
          <span className="flex flex-col gap-1">
            <strong>Virou conteúdo para {shortDate(pauta.content.date)}</strong>
            <StatusTag status={pauta.content.status} short />
          </span>
          <span className="font-semibold text-rosa-forte">Abrir a peça</span>
        </Link>
      )}

      {admin && pauta.status !== "calendario" && calendar && <ToCalendar pauta={pauta} onDone={() => setCalendar(false)} />}

      <div className="flex flex-wrap items-center gap-2.5">
        {admin && pauta.status !== "calendario" && !calendar && (
          <button type="button" onClick={() => setCalendar(true)} className={`${buttonClass.primary} min-h-11 text-sm`}>
            Levar pro calendário
          </button>
        )}
        {admin && pauta.status !== "calendario" && (
          <button
            type="button"
            onClick={() => run(() => setStatus({ pautaId: pauta._id, status: pauta.status === "guardada" ? "vista" : "guardada" }))}
            className={`${buttonClass.outline} min-h-11 text-sm`}
          >
            {pauta.status === "guardada" ? "Trazer de volta" : "Guardar para depois"}
          </button>
        )}
        {edit && pauta.status !== "calendario" && (
          <button
            type="button"
            onClick={() => confirm(`Apagar a pauta "${pauta.title}"?`) && run(() => remove({ pautaId: pauta._id }))}
            className="min-h-11 px-2 text-sm font-semibold text-st-ajuste-texto"
          >
            Apagar pauta
          </button>
        )}
        <span className="ml-auto text-xs text-texto-2">
          {pauta.authorIsStudio ? "Do estúdio" : `Por ${pauta.authorName}`}, {stamp(pauta.at)}
        </span>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
    </div>
  );
}

function PautaRow({ pauta, open, onToggle, admin, base, months }: { pauta: Pauta; open: boolean; onToggle: () => void; admin: boolean; base: string; months: string[] }) {
  const st = STATUS[pauta.status];
  return (
    <li className={`overflow-hidden rounded-peca bg-white transition-shadow ${open ? "shadow-flutua" : ""} ${pauta.status === "guardada" ? "opacity-70" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3.5 text-left md:grid-cols-[96px_minmax(0,1fr)_150px_130px_170px_20px] md:px-5"
      >
        <span className="row-span-2 md:row-span-1">
          <FormatChip format={pauta.format} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <strong className="truncate text-[15px] leading-tight md:text-base">{pauta.title}</strong>
          {pauta.notes && <span className="truncate text-[13px] text-texto-2">{pauta.notes.split("\n")[0]}</span>}
        </span>
        <svg width="14" height="14" viewBox="0 0 10 10" aria-hidden="true" className={`row-span-2 justify-self-end transition-transform md:order-last md:row-span-1 ${open ? "rotate-180" : ""}`}>
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-2 md:contents">
          <span className="md:text-sm">{monthLabel(pauta.month)}</span>
          <span className="flex items-center gap-1.5 md:justify-start">
            {pauta.files.length > 0 ? <Thumbs files={pauta.files} size={32} /> : <span className="hidden text-texto-2 md:inline">Sem anexo</span>}
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-vinho md:text-[13px]">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: st.color }} />
            {pauta.status === "calendario" && pauta.content ? `No calendário, ${shortDate(pauta.content.date)}` : st.label}
            {pauta.studioNote && !admin && <span className="rounded-full bg-rosa px-2 text-[11px] text-vinho">comentário</span>}
          </span>
        </span>
      </button>
      {open && <PautaDetail pauta={pauta} admin={admin} base={base} months={months} />}
    </li>
  );
}

/* ---------- Quadro ---------- */

export function PautasBoard({ slug, admin }: { slug: string; admin: boolean }) {
  const pautas = useQuery(api.pautas.list, { slug });
  const markSeen = useMutation(api.pautas.markSeen);
  // A admin abriu o banco: as pautas novas passam a "vistas" (e somem do aviso do Estúdio).
  const hasNew = !!pautas?.some((p) => p.status === "nova");
  useEffect(() => {
    if (admin && hasNew) markSeen({ slug }).catch(() => {});
  }, [admin, hasNew, slug, markSeen]);
  if (pautas === undefined) return <Loading />;
  return <PautasView pautas={pautas} slug={slug} admin={admin} />;
}

export function PautasView({ pautas, slug, admin }: { pautas: Pauta[]; slug: string; admin: boolean }) {
  const [month, setMonth] = useState<string>("todos");
  const [format, setFormat] = useState<string>("todos");
  const [showSaved, setShowSaved] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const base = `/w/${slug}`;

  const months = useMemo(() => monthOptions(pautas.map((p) => p.month)), [pautas]);

  const inMonth = pautas.filter((p) => month === "todos" || (month === "sem" ? !p.month : p.month === month));
  const active = inMonth.filter((p) => p.status !== "guardada");
  const saved = inMonth.filter((p) => p.status === "guardada");
  const visible = (showSaved ? saved : active).filter((p) => format === "todos" || p.format === format);

  // Agrupa por mês, na ordem do calendário; "sem pressa" no fim.
  const groups = new Map<string, Pauta[]>();
  for (const p of [...visible].sort((a, b) => (a.month ?? "9999").localeCompare(b.month ?? "9999") || b.at - a.at)) {
    const k = p.month ?? "";
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }

  const byFormat = FORMATS.map((f) => ({ ...f, n: active.filter((p) => p.format === f.id).length })).filter((f) => f.n > 0);
  const filterMonths = [...new Set(pautas.map((p) => p.month).filter((m): m is string => !!m))].sort();

  return (
    <div className="flex flex-col gap-6">
      <QuickAdd slug={slug} months={months} admin={admin} />

      {pautas.length === 0 ? (
        <div className="flex items-start gap-3 rounded-peca border-[1.5px] border-dashed border-campo px-5 py-6 text-base text-texto-3">
          <Asterisk size={22} color="var(--color-rosa)" />
          <span>
            {admin
              ? "O banco ainda está vazio. Quando a cliente anotar pautas, elas aparecem aqui."
              : "Seu banco de pautas está vazio. Anote acima o que você quer falar, escolha o formato e o mês. Pode anexar fotos e vídeos."}
          </span>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <span className="text-[28px] font-extrabold leading-none tracking-[-0.04em]">
                {active.length} <span className="text-base font-semibold tracking-normal text-texto-3">{active.length === 1 ? "pauta" : "pautas"}</span>
              </span>
              {byFormat.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: f.color }} />
                  {f.n} {f.label}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="filtro-mes">Mês</label>
              <select id="filtro-mes" value={month} onChange={(e) => setMonth(e.target.value)} className="min-h-10 rounded-full border border-campo bg-white pl-3.5 pr-8 text-sm text-vinho">
                <option value="todos">Todos os meses</option>
                {filterMonths.map((m) => (
                  <option key={m} value={m}>{monthLabel(m)}</option>
                ))}
                <option value="sem">Sem pressa</option>
              </select>
              <div role="group" aria-label="Formato" className="flex gap-1.5 overflow-x-auto">
                {[{ id: "todos", label: "Todos", color: "var(--color-vinho)" }, ...FORMATS].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={format === f.id}
                    onClick={() => setFormat(f.id)}
                    className={`min-h-10 shrink-0 rounded-full border px-3.5 text-sm ${format === f.id ? "border-vinho bg-vinho font-semibold text-white" : "border-campo bg-white"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {saved.length > 0 && (
                <button type="button" aria-pressed={showSaved} onClick={() => setShowSaved((s) => !s)} className="min-h-10 px-2 text-sm font-semibold text-rosa-forte">
                  {showSaved ? "Ver pautas ativas" : `Guardadas ${saved.length}`}
                </button>
              )}
            </div>
          </div>

          <div className="hidden grid-cols-[96px_minmax(0,1fr)_150px_130px_170px_20px] gap-3 px-5 text-xs font-semibold uppercase tracking-wide text-texto-2 md:grid">
            <span>Formato</span>
            <span>Tema</span>
            <span>Para quando</span>
            <span>Anexos</span>
            <span>Status</span>
          </div>

          {visible.length === 0 ? (
            <p className="text-base text-texto-2">Nada neste filtro.</p>
          ) : (
            [...groups.entries()].map(([m, list]) => (
              <section key={m || "sem"} className="flex flex-col gap-2.5">
                {month === "todos" && (
                  <h3 className="flex items-baseline gap-2 px-1 text-lg font-extrabold tracking-[-0.03em]">
                    {monthLabel(m || null)} <span className="text-sm font-semibold text-texto-2">{list.length}</span>
                  </h3>
                )}
                <ul className="flex flex-col gap-2">
                  {list.map((p) => (
                    <PautaRow
                      key={p._id}
                      pauta={p}
                      open={openId === p._id}
                      onToggle={() => setOpenId((o) => (o === p._id ? null : p._id))}
                      admin={admin}
                      base={base}
                      months={months}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
