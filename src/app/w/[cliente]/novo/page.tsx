"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { Suspense, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { buttonClass } from "@/components/brand";
import { Step } from "@/components/briefing/BriefingForm";
import { errorText } from "@/components/content/DecisionSheet";
import { useWorkspace } from "@/components/WorkspaceShell";
import { todayISO } from "@/lib/dates";
import { FORMAT, PLATFORM, type Format, type Platform } from "@/lib/labels";

const field = "min-h-12 border-[1.5px] border-campo bg-white px-3 text-base font-normal";
const OBJECTIVES = ["Educar", "Engajar", "Vender", "Mostrar bastidores", "Autoridade", "Divulgar data ou evento"];

function NovoForm() {
  const { cliente } = useParams<{ cliente: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const ws = useWorkspace();
  const create = useMutation(api.contents.create);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<string[]>([""]);

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
        briefing: {
          objective: String(d.get("objective") ?? "").trim() || undefined,
          body: String(d.get("body") ?? ""),
          links: links.map((l) => l.trim()).filter(Boolean),
        },
      });
      router.replace(`/w/${cliente}/c/${id}/editar`);
    } catch (err) {
      setError(errorText(err));
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="titulo text-5xl">Novo conteúdo para {ws.name}</h1>
        {params.get("ideia") && <p className="text-sm font-semibold text-rosa-forte">A partir de uma ideia da Caixa de Ideias</p>}
        {params.get("oportunidade") && <p className="text-sm font-semibold text-rosa-forte">A partir de uma data do nicho</p>}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-8">
        <Step n={1} title="O que é o conteúdo">
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
        </Step>

        <Step n={2} title="Briefing" hint="Fica na ficha da peça, só para o estúdio. Se deixar em branco, dá para escrever depois.">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Objetivo
            <input name="objective" list="objetivos-novo" placeholder="Escolha ou escreva" className={field} />
            <datalist id="objetivos-novo">
              {OBJECTIVES.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            O briefing
            <textarea
              name="body"
              rows={7}
              maxLength={6000}
              placeholder={"Mensagem principal:\nPara quem:\nTom:\nNão pode faltar:\nEvitar:"}
              className={`${field} py-3 leading-relaxed`}
            />
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Links de referência</span>
            {links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <label className="sr-only" htmlFor={`link-${i}`}>Link {i + 1}</label>
                <input
                  id={`link-${i}`}
                  type="url"
                  inputMode="url"
                  value={l}
                  onChange={(e) => setLinks((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder="https://"
                  className={`${field} w-full`}
                />
                {links.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLinks((arr) => arr.filter((_, j) => j !== i))}
                    aria-label={`Tirar link ${i + 1}`}
                    className="flex size-12 shrink-0 items-center justify-center rounded-full text-xl text-texto-2 hover:bg-white"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {links.length < 10 && (
              <button type="button" onClick={() => setLinks((arr) => [...arr, ""])} className="min-h-11 self-start text-[15px] font-semibold text-rosa-forte">
                Mais um link
              </button>
            )}
          </div>
        </Step>

        {error && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{error}</p>}
        <div className="border-t border-linha pt-6">
          <button type="submit" disabled={pending} className={buttonClass.primary}>
            {pending ? "Criando" : "Criar e abrir o editor"}
          </button>
        </div>
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
