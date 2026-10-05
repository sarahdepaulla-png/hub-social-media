"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import { Loading, buttonClass } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { longDate, todayISO } from "@/lib/dates";
import { DEFAULT_NICHES } from "@/lib/niches";

const field = "min-h-11 border border-campo bg-white px-3 text-[15px] font-normal";

export default function BibliotecaPage() {
  const list = useQuery(api.opportunities.listAll, {});
  const clients = useQuery(api.clients.listAdmin, {});
  const create = useMutation(api.opportunities.create);
  const remove = useMutation(api.opportunities.remove);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const today = todayISO();

  const niches = useMemo(
    () => Array.from(new Set([...DEFAULT_NICHES, ...(clients ?? []).flatMap((c) => c.niches)])).sort(),
    [clients],
  );

  if (list === undefined || clients === undefined) return <Loading />;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    setError(null);
    try {
      await create({
        date: String(d.get("date")),
        title: String(d.get("title")),
        hint: String(d.get("hint") ?? ""),
        niches: d.getAll("niches").map(String),
        allMonth: d.get("allMonth") === "on",
        clientSlug: String(d.get("client") ?? "") || undefined,
      });
      form.reset();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const visible = list.filter((o) => showPast || o.date >= today.slice(0, 7) + "-01");

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="titulo text-6xl">Biblioteca de datas</h1>
        <p className="max-w-2xl text-base leading-relaxed text-texto-3">
          Cada data aparece para os clientes do nicho marcado. Cadastre uma vez e ela vale para todos os clientes daquele nicho.
        </p>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-4 rounded-peca bg-white p-5">
        <h2 className="text-xl font-extrabold tracking-[-0.04em]">Nova data</h2>
        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Data
            <input name="date" type="date" required className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Nome
            <input name="title" required placeholder="Ex.: Dia Mundial da Coluna" className={field} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Dica de pauta (opcional)
          <input name="hint" placeholder="Ex.: postura e dor lombar" className={field} />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1.5 text-[13px] font-semibold">Nichos</legend>
          <div className="flex flex-wrap gap-2">
            {niches.map((n) => (
              <label key={n} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-campo bg-white px-3.5 text-sm has-[:checked]:border-vinho has-[:checked]:bg-rosa">
                <input type="checkbox" name="niches" value={n} className="sr-only" />
                {n}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Ou só para um cliente
            <select name="client" defaultValue="" className={field}>
              <option value="">Todos do nicho</option>
              {clients.map((c) => (
                <option key={c._id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2.5 text-sm">
            <input type="checkbox" name="allMonth" className="size-[18px] accent-rosa-forte" />
            Vale o mês inteiro (ex.: Outubro Rosa)
          </label>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
        <button type="submit" className={`${buttonClass.primary} self-start`}>Adicionar data</button>
      </form>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[22px] font-extrabold tracking-[-0.045em]">{visible.length} datas</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} className="size-4 accent-rosa-forte" />
            Mostrar passadas
          </label>
        </div>
        <ul className="flex flex-col">
          {visible.map((o) => (
            <li key={o._id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-linha py-3 last:border-b">
              <span className="flex flex-col gap-0.5">
                <strong className="text-base">{o.title}</strong>
                <span className="text-[13px] text-texto-2">
                  {o.allMonth ? `Mês inteiro de ${longDate(o.date).split(" de ")[1] ?? ""}` : longDate(o.date)}.{" "}
                  {o.clientName ? `Só ${o.clientName}` : o.niches.join(", ")}
                </span>
              </span>
              <button type="button" onClick={() => confirm(`Remover "${o.title}"?`) && remove({ opportunityId: o._id })} className="min-h-9 text-sm font-semibold text-st-ajuste-texto">
                Remover
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
