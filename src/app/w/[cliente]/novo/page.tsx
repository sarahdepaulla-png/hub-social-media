"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { Suspense, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { buttonClass } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";
import { useWorkspace } from "@/components/WorkspaceShell";
import { todayISO } from "@/lib/dates";
import { FORMAT, PLATFORM, type Format, type Platform } from "@/lib/labels";

const field = "min-h-12 border-[1.5px] border-campo bg-white px-3 text-base font-normal";

function NovoForm() {
  const { cliente } = useParams<{ cliente: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const ws = useWorkspace();
  const create = useMutation(api.contents.create);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ws.viewerRole !== "admin") return <p className="px-6 py-16 text-lg">Só a administradora cria conteúdos.</p>;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const id = await create({
        clientSlug: cliente,
        date: String(d.get("date")),
        title: String(d.get("title")),
        platform: d.get("platform") as Platform,
        format: d.get("format") as Format,
        sourceIdeaId: (params.get("ideia") as Id<"ideas"> | null) ?? undefined,
        sourceOpportunityId: (params.get("oportunidade") as Id<"opportunities"> | null) ?? undefined,
      });
      router.replace(`/w/${cliente}/c/${id}/editar`);
    } catch (err) {
      setError(errorText(err));
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="titulo text-5xl">Novo conteúdo para {ws.name}</h1>
        {params.get("ideia") && <p className="text-sm font-semibold text-rosa-forte">A partir de uma ideia da Caixa de Ideias</p>}
        {params.get("oportunidade") && <p className="text-sm font-semibold text-rosa-forte">A partir de uma data do nicho</p>}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Tema
          <input name="title" required defaultValue={params.get("tema") ?? ""} placeholder="Ex.: 5 erros no alongamento" className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Data
          <input name="date" type="date" required defaultValue={params.get("data") ?? todayISO()} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Plataforma
            <select name="platform" defaultValue="instagram" className={field}>
              {Object.entries(PLATFORM).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Formato
            <select name="format" defaultValue="carrossel" className={field}>
              {Object.entries(FORMAT).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Criando" : "Criar e abrir o editor"}
        </button>
      </form>
    </main>
  );
}

export default function NovoPage() {
  return (
    <Suspense>
      <NovoForm />
    </Suspense>
  );
}
