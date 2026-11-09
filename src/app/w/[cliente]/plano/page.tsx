"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@convex/_generated/api";
import { Loading, buttonClass } from "@/components/brand";
import { useWorkspace } from "@/components/WorkspaceShell";
import { errorText } from "@/components/content/DecisionSheet";
import { PlanView } from "@/components/plan/PlanView";
import { PlanEditor } from "@/components/plan/PlanEditor";
import { currentMonth, monthName, shiftMonth, stamp } from "@/lib/dates";

const STATUS_LABEL = {
  rascunho: { text: "Rascunho: só você vê", color: "var(--color-st-ideia)" },
  aguardando: { text: "Esperando a cliente", color: "var(--color-st-aguardando)" },
  aprovado: { text: "Aprovado pela cliente", color: "var(--color-st-aprovado)" },
  ajuste: { text: "Cliente pediu ajuste", color: "var(--color-st-ajuste)" },
} as const;

function MonthNav({ month, base }: { month: string; base: string }) {
  const arrow = "flex size-11 items-center justify-center rounded-full border-[1.5px] border-campo bg-white hover:border-vinho";
  return (
    <nav aria-label="Mês do plano" className="flex items-center gap-2">
      <Link href={`${base}/plano?mes=${shiftMonth(month, -1)}`} className={arrow} aria-label="Mês anterior">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </Link>
      <span className="min-w-[130px] text-center text-base font-bold">
        {monthName(month)} {month.slice(0, 4)}
      </span>
      <Link href={`${base}/plano?mes=${shiftMonth(month, 1)}`} className={arrow} aria-label="Próximo mês">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </Link>
    </nav>
  );
}

/** Barra da admin: status, editar, enviar e mandar no WhatsApp. */
function AdminBar({
  slug,
  month,
  name,
  status,
  sentAt,
  readyMail,
  whatsapp,
  people,
  onEdit,
}: {
  slug: string;
  month: string;
  name: string;
  status: keyof typeof STATUS_LABEL;
  sentAt: number | null;
  readyMail: { at: number; to?: string[]; error?: string } | null;
  whatsapp: string | null;
  people: { name: string; token: string }[];
  onEdit: () => void;
}) {
  const setStatus = useMutation(api.plans.setStatus);
  const resend = useMutation(api.plans.resendReadyMail);
  const [copied, setCopied] = useState(false);
  const [who, setWho] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const person = people[who] ?? null;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const page = `/w/${slug}/plano?mes=${month}`;
  const link = person ? `${origin}/acesso/${person.token}?ir=${encodeURIComponent(page)}` : `${origin}${page}`;
  const first = (person?.name ?? name).split(" ")[0];
  const message = `Oi, ${first}! Seu calendário de ${monthName(month).toLowerCase()} está pronto para aprovação.\n\nMontei o plano do mês pra você ver como pensei tudo: o caminho, os posts e como o feed vai ficar.\n\nÉ só abrir, dar uma olhada e tocar em "Aprovar e mandar pro calendário" (ou pedir ajuste se quiser mudar algo):\n${link}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sem permissão de cópia */
    }
  };
  const run = (s: "rascunho" | "aguardando") => setStatus({ slug, month, status: s }).catch((e) => setError(errorText(e)));

  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: STATUS_LABEL[status].color }} />
          {STATUS_LABEL[status].text}
          {sentAt && status !== "rascunho" ? <span className="font-normal text-texto-2">· enviado {stamp(sentAt)}</span> : null}
        </span>
        <span className="flex-1" />
        <button type="button" onClick={onEdit} className="min-h-11 rounded-full border-[1.5px] border-vinho px-4 text-sm font-semibold hover:bg-creme">
          Editar plano
        </button>
        {status === "rascunho" || status === "ajuste" ? (
          <button type="button" onClick={() => void run("aguardando")} className="min-h-11 rounded-full bg-vinho px-5 text-sm font-bold text-white hover:bg-vinho-escuro">
            {status === "ajuste" ? "Reenviar para a cliente" : "Enviar para a cliente"}
          </button>
        ) : (
          <button type="button" onClick={() => void run("rascunho")} className="min-h-11 rounded-full px-4 text-sm font-semibold text-texto-3 hover:bg-creme">
            Voltar para rascunho
          </button>
        )}
      </div>
      {status === "aguardando" && (
        <div className="flex flex-col gap-3 border-t border-linha pt-3">
          <span className="text-sm text-texto-3">
            {readyMail === null
              ? "O e-mail para a cliente ainda não saiu."
              : readyMail.error
                ? `E-mail não saiu: ${readyMail.error}`
                : `E-mail enviado para ${readyMail.to?.join(", ")}, ${stamp(readyMail.at)}.`}{" "}
            <button type="button" onClick={() => void resend({ slug, month }).catch((e) => setError(errorText(e)))} className="font-semibold text-rosa-forte underline">
              {readyMail === null ? "Mandar o e-mail" : "Mandar o e-mail de novo"}
            </button>
          </span>
          <p className="whitespace-pre-wrap rounded-xl bg-creme p-3 text-sm leading-relaxed text-texto-3">{message}</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={`https://wa.me/${whatsapp ?? ""}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1F8F4E] px-5 text-sm font-bold text-white hover:bg-[#187540]"
            >
              Mandar no WhatsApp
            </a>
            <button type="button" onClick={() => void copy()} className="min-h-11 rounded-full border-[1.5px] border-vinho px-4 text-sm font-semibold hover:bg-creme">
              {copied ? "Mensagem copiada" : "Copiar mensagem"}
            </button>
            {people.length > 1 && (
              <label className="flex items-center gap-2 text-sm font-semibold">
                Para
                <select value={who} onChange={(e) => setWho(Number(e.target.value))} className="min-h-11 border border-campo bg-white px-3 text-[15px] font-normal">
                  {people.map((p, i) => (
                    <option key={p.token} value={i}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <span className="text-xs text-texto-2">
            {person ? `O link é o acesso pessoal de ${person.name}: entra direto, sem código. Mande só para ela.` : "Sem acesso pessoal: a cliente entra com o código."}
            {!whatsapp && " Sem WhatsApp cadastrado: o WhatsApp abre para você escolher o contato."}
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">
          {error}
        </p>
      )}
    </div>
  );
}

function PlanPage() {
  const ws = useWorkspace();
  const params = useSearchParams();
  const month = /^\d{4}-\d{2}$/.test(params.get("mes") ?? "") ? params.get("mes")! : currentMonth();
  const data = useQuery(api.plans.get, { slug: ws.slug, month });
  const [editing, setEditing] = useState<string | null>(null);
  const base = `/w/${ws.slug}`;

  if (data === undefined) return <Loading />;
  const isEditing = editing === month && data.isAdmin;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-28 pt-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav month={month} base={base} />
        {data.months.length > 0 && (
          <span className="flex flex-wrap gap-2 text-sm">
            {data.months
              .filter((m) => m.month !== month)
              .slice(-4)
              .map((m) => (
                <Link key={m.month} href={`${base}/plano?mes=${m.month}`} className="rounded-full bg-white px-3 py-1.5 font-semibold text-rosa-forte hover:bg-[#FFF6FA]">
                  {monthName(m.month)}
                </Link>
              ))}
          </span>
        )}
      </div>

      {isEditing ? (
        <PlanEditor key={month} data={data} slug={ws.slug} month={month} onDone={() => setEditing(null)} />
      ) : data.plan ? (
        <>
          {data.isAdmin && (
            <AdminBar
              slug={ws.slug}
              month={month}
              name={ws.name}
              status={data.plan.status}
              sentAt={data.plan.sentAt}
              readyMail={data.plan.readyMail}
              whatsapp={data.whatsapp}
              people={data.people}
              onEdit={() => setEditing(month)}
            />
          )}
          <PlanView data={data} plan={data.plan} slug={ws.slug} month={month} />
        </>
      ) : (
        <section className="flex flex-col items-start gap-4 rounded-[22px] bg-white p-6 md:p-8">
          <h1 className="titulo text-5xl">Plano de {monthName(month).toLowerCase()}</h1>
          {data.isAdmin ? (
            <>
              <p className="max-w-[560px] text-base leading-relaxed text-texto-3">
                O plano mostra o mês inteiro como um vision board: tema, objetivos, o caminho em fases, o calendário e como o feed vai ficar. As peças vêm do calendário
                {data.pieces.length ? ` (${data.pieces.length} neste mês)` : ""}; você escreve a estratégia.
              </p>
              <button type="button" onClick={() => setEditing(month)} className={buttonClass.primary}>
                Montar o plano
              </button>
            </>
          ) : (
            <p className="text-base text-texto-3">
              {data.hiddenDraft
                ? "Você está vendo como a cliente. O plano deste mês ainda está em rascunho, então ela não vê. Volte para o estúdio e toque em Enviar para a cliente."
                : "O plano deste mês ainda não chegou. Quando o estúdio enviar, ele aparece aqui."}
            </p>
          )}
        </section>
      )}
    </main>
  );
}

export default function PlanoPage() {
  return (
    <Suspense>
      <PlanPage />
    </Suspense>
  );
}
