"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Asterisk, Loading, SelectionBox, StatusTag, Thumb, buttonClass } from "@/components/brand";
import { useWorkspace } from "@/components/WorkspaceShell";
import { StatusMenu } from "@/components/StatusMenu";
import { currentMonth, monthName, shortDate, todayISO } from "@/lib/dates";
import { BRIEF_STATUS, FORMAT, PLATFORM } from "@/lib/labels";

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

const PLATFORM_NAME: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", pinterest: "Pinterest", site: "Site" };

/** Briefings abertos: o que a cliente pediu e em que pé está. */
function BriefingStrip({ slug }: { slug: string }) {
  const list = useQuery(api.briefings.list, { slug });
  if (!list || list.length === 0) return null;
  const base = `/w/${slug}`;
  return (
    <section className="flex flex-col gap-3 px-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-extrabold tracking-[-0.04em]">Briefings</h2>
        <Link href={`${base}/briefing/novo`} className="min-h-11 content-center text-[15px] font-semibold text-rosa-forte">
          Abrir outro
        </Link>
      </div>
      <ul className="flex flex-col">
        {list.slice(0, 5).map((b) => {
          const st = BRIEF_STATUS[b.status];
          return (
            <li key={b._id} className="border-t border-linha last:border-b">
              <Link href={`${base}/briefing/${b._id}`} className="flex items-center justify-between gap-4 py-3.5">
                <span className="flex min-w-0 flex-col gap-1">
                  <strong className="truncate text-base leading-tight">{b.title}</strong>
                  <span className="text-[13px] text-texto-2">
                    {b.desiredDate ? `Para ${shortDate(b.desiredDate)}` : "Sem data"}. {b.authorIsStudio ? "Do estúdio" : `Pedido por ${b.authorName}`}
                  </span>
                </span>
                {b.content ? (
                  <StatusTag status={b.content.status} short className="shrink-0" />
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold">
                    <span aria-hidden="true" className="size-2 rounded-full" style={{ background: st.color }} />
                    {st.label}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Mural em miniatura: as últimas referências, com atalho para o mural completo. */
function IdeaStrip({ slug }: { slug: string }) {
  const ideas = useQuery(api.ideas.latest, { slug });
  const href = `/w/${slug}/ideias`;
  if (ideas === undefined) return null;
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between px-6">
        <h2 className="text-[22px] font-extrabold tracking-[-0.045em]">Ideias e referências</h2>
        <Link href={href} className="min-h-11 content-center text-[15px] font-semibold text-rosa-forte">
          {ideas.length ? "Ver mural" : "Adicionar"}
        </Link>
      </div>
      {ideas.length === 0 ? (
        <Link href={href} className="mx-6 rounded-peca border border-dashed border-campo p-5 text-[15px] text-texto-2 hover:border-vinho">
          Viu um post que é a sua cara? Cole o link no mural de ideias.
        </Link>
      ) : (
        <ul className="flex snap-x gap-3 overflow-x-auto px-6 pb-1">
          {ideas.map((i, n) => (
            <li key={i._id} className="w-32 shrink-0 snap-start">
              <Link href={href} className="flex flex-col gap-1.5">
                {i.imageUrl ? (
                  <Thumb url={i.imageUrl} tone={n} className="aspect-[4/5] w-full" />
                ) : (
                  <span className="grade-rosa flex aspect-[4/5] w-full items-center justify-center rounded-peca p-2 text-center text-sm font-black text-white">
                    {i.platform ? PLATFORM_NAME[i.platform] : "Ideia"}
                  </span>
                )}
                <span className="line-clamp-2 text-[13px] font-semibold leading-tight">{i.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function InicioPage() {
  const ws = useWorkspace();
  const month = currentMonth();
  const data = useQuery(api.dashboard.forClient, { slug: ws.slug, month, today: todayISO() });

  if (data === undefined) return <Loading />;
  const { counts, waiting, adjusting, upcoming } = data;
  const base = `/w/${ws.slug}`;
  const admin = ws.viewerRole === "admin";

  const headline =
    counts.total === 0
      ? "O planejamento deste mês ainda está sendo montado."
      : waiting.length === 0
        ? `${plural(counts.total, "conteúdo", "conteúdos")} no mês. Nada esperando você agora.`
        : null;

  return (
    <main className="flex flex-col gap-10 pb-12">
      <section className="grade-rosa">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 pb-9 pt-6 md:pb-14 md:pt-10">
          <h1 className="titulo flex items-center gap-3 text-[76px] text-white md:text-[128px]">
            {monthName(month)} <Asterisk size={52} color="var(--color-vinho)" className="md:size-20" />
          </h1>
          <SelectionBox className="ml-1.5 self-start px-3.5 py-2.5 text-base leading-snug md:text-xl">
            {headline ?? (
              <>
                {plural(counts.total, "conteúdo", "conteúdos")} no mês.{" "}
                <strong>{plural(waiting.length, "espera", "esperam")} a sua decisão.</strong>
              </>
            )}
          </SelectionBox>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href={`${base}/briefing/novo`} className={admin ? buttonClass.secondary : buttonClass.primary}>
              Abrir briefing
            </Link>
            {admin && (
              <Link href={`${base}/novo`} className={buttonClass.primary}>
                Novo conteúdo
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section aria-label="Resumo do mês" className="mx-6 grid grid-cols-6 border-y border-linha md:grid-cols-5">
          {[
            { n: counts.publicados, label: "Postados", status: "publicado" as const },
            { n: counts.aprovados, label: "Aprovados", status: "aprovado" as const },
            { n: counts.aguardando, label: "Aguardando", status: "aguardando" as const },
            { n: counts.ajuste, label: "Ajustes", status: "ajuste" as const },
            { n: counts.producao + counts.ideia, label: "Produção", status: "producao" as const },
          ].map((c, i) => (
            <div
              key={c.label}
              className={`flex flex-col gap-1 py-3 md:col-span-1 md:py-5 ${i < 3 ? "col-span-2" : "col-span-3 border-t border-linha md:border-t-0"}`}
            >
              <span className="text-[34px] font-extrabold leading-none tracking-[-0.04em] md:text-5xl">{c.n}</span>
              <StatusTag status={c.status} short className="text-xs md:text-sm" />
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between px-6">
            <h2 className="text-[26px] font-extrabold tracking-[-0.045em] md:text-3xl">Esperando você</h2>
            {waiting.length > 0 && (
              <Link href={`${base}/c/${waiting[0]._id}`} className="min-h-11 content-center text-[15px] font-semibold text-rosa-forte">
                Começar
              </Link>
            )}
          </div>
          {waiting.length === 0 ? (
            <p className="px-6 text-base text-texto-2">Tudo em dia. Quando houver peça nova, ela aparece aqui.</p>
          ) : (
            <ul className="flex snap-x gap-3.5 overflow-x-auto px-6 pb-2 md:grid md:grid-cols-4 md:overflow-visible">
              {waiting.map((c, i) => (
                <li key={c._id} className="flex w-[214px] shrink-0 snap-start flex-col gap-2 md:w-auto">
                  <Link href={`${base}/c/${c._id}`} className="group flex flex-col gap-2.5">
                    <Thumb
                      url={c.coverUrl}
                      tone={i}
                      label={FORMAT[c.format]}
                      className="aspect-[4/5] w-full transition-transform duration-200 group-hover:-rotate-1"
                    />
                    <span className="text-[13px] text-texto-2">
                      {shortDate(c.date)}. {PLATFORM[c.platform]}
                    </span>
                    <strong className="text-base leading-tight">{c.title}</strong>
                  </Link>
                  {admin && <StatusMenu contentId={c._id} status={c.status} editable short />}
                </li>
              ))}
            </ul>
          )}
        </section>

        <BriefingStrip slug={ws.slug} />

        <IdeaStrip slug={ws.slug} />

        {adjusting.length > 0 && (
          <section className="flex flex-col gap-3 px-6">
            <h2 className="text-xl font-extrabold tracking-[-0.04em]">Em ajuste pelo estúdio</h2>
            <ul className="flex flex-col">
              {adjusting.map((c) => (
                <li key={c._id} className="flex items-center justify-between gap-4 border-t border-linha last:border-b">
                  <Link href={`${base}/c/${c._id}`} className="flex flex-1 flex-col gap-1 py-3.5">
                    <strong className="text-base leading-tight">{c.title}</strong>
                    <span className="text-[13px] text-texto-2">{shortDate(c.date)}</span>
                  </Link>
                  <StatusMenu contentId={c._id} status={c.status} editable={admin} short />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-3 px-6">
          <h2 className="text-xl font-extrabold tracking-[-0.04em]">Próximos no ar</h2>
          {upcoming.length === 0 ? (
            <p className="text-base text-texto-2">Nenhuma publicação programada daqui até o fim do mês.</p>
          ) : (
            <ul className="flex flex-col">
              {upcoming.map((c, i) => (
                <li key={c._id} className="flex items-center gap-4 border-t border-linha last:border-b">
                  <Link href={`${base}/c/${c._id}`} className="flex min-w-0 flex-1 items-center gap-4 py-3">
                    <Thumb url={c.coverUrl} tone={i + 1} className="h-[70px] w-14 shrink-0 rounded-lg" />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <strong className="truncate text-base">{c.title}</strong>
                      <span className="text-[13px] text-texto-2">
                        {shortDate(c.date)}. {PLATFORM[c.platform]}, {FORMAT[c.format].toLowerCase()}
                      </span>
                    </span>
                  </Link>
                  <StatusMenu contentId={c._id} status={c.status} editable={admin} short className="shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
