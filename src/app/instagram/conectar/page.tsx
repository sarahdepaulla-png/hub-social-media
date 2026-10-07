"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import { Asterisk, Loading, Logo, buttonClass } from "@/components/brand";
import { errorText } from "@/components/content/DecisionSheet";

/**
 * Conectar o Instagram pelo login do Facebook. Funciona sem login no Hub para a cliente
 * (o link ?s=... já diz quem é). O Facebook volta aqui com ?code=...&state=...
 */
function Conectar() {
  const params = useSearchParams();
  const code = params.get("code");
  const returnedState = params.get("state");
  const fbError = params.get("error_description") ?? params.get("error_message") ?? params.get("error");
  const state = params.get("s") ?? returnedState ?? "";
  const [stage, setStage] = useState<"inicio" | "conectando" | "escolher" | "pronto" | "erro">(code ? "conectando" : "inicio");
  const [message, setMessage] = useState<string | null>(null);
  const info = useQuery(api.instagram.connectInfo, state && stage !== "pronto" ? { state } : "skip");
  const finish = useAction(api.instagram.finishConnect);
  const assign = useMutation(api.instagram.assignAccounts);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!code || !returnedState || started.current) return;
    started.current = true;
    finish({ state: returnedState, code })
      .then((r) => {
        if (r.connected) {
          setStage("pronto");
          setMessage(`@${r.connected} conectado. As métricas começam a aparecer em alguns minutos.`);
        } else setStage("escolher");
      })
      .catch((err) => {
        setStage("erro");
        setMessage(errorText(err));
      });
  }, [code, returnedState, finish]);

  const save = async () => {
    if (!info?.ok) return;
    setBusy(true);
    try {
      const pairs = info.clientName
        ? [{ igUserId: picks.unica ?? "" }]
        : info.candidates.map((c) => ({ igUserId: c.igUserId, clientSlug: picks[c.igUserId] || undefined }));
      const done = await assign({ state, pairs });
      setStage("pronto");
      setMessage(done.length ? `Conectado: ${done.map((u) => `@${u}`).join(", ")}. As métricas começam a aparecer em alguns minutos.` : "Nenhuma conta foi ligada.");
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  let title = "Conectar o Instagram";
  let body: React.ReactNode;

  if (fbError) {
    title = "Não conectou";
    body = <p className="text-lg leading-relaxed text-texto-3">O Facebook não autorizou ({fbError}). Tente de novo pelo mesmo link.</p>;
  } else if (stage === "conectando") {
    body = <Loading label="Conectando" />;
  } else if (stage === "pronto" || stage === "erro") {
    title = stage === "pronto" ? "Conectado" : "Não conectou";
    body = <p className="text-lg leading-relaxed text-texto-3">{message}</p>;
  } else if (!state) {
    body = <p className="text-lg leading-relaxed text-texto-3">Abra o link de conexão que o estúdio mandou.</p>;
  } else if (info === undefined) {
    body = <Loading />;
  } else if (!info.ok) {
    title = "Link indisponível";
    body = <p className="text-lg leading-relaxed text-texto-3">{info.reason}</p>;
  } else if (stage === "escolher" || info.candidates.length > 0) {
    title = info.clientName ? "Qual é a sua conta?" : "Qual conta é de quem?";
    body = (
      <>
        <p className="text-lg leading-relaxed text-texto-3">
          {info.clientName ? "Achamos mais de um Instagram nesse Facebook. Escolha o seu." : "Ligue cada Instagram encontrado ao cliente certo. Deixe em branco o que não for de cliente."}
        </p>
        <ul className="flex flex-col gap-2.5">
          {info.candidates.map((c) => (
            <li key={c.igUserId} className="flex flex-wrap items-center gap-3 rounded-peca bg-white p-3.5">
              {c.pictureUrl ? <img src={c.pictureUrl} alt="" className="size-11 rounded-full object-cover" /> : <span className="size-11 rounded-full bg-thumb" />}
              <span className="flex min-w-0 flex-1 flex-col">
                <strong className="truncate">@{c.username}</strong>
                <span className="truncate text-xs text-texto-2">Página: {c.pageName}{c.followers !== undefined ? `, ${c.followers.toLocaleString("pt-BR")} seguidores` : ""}</span>
              </span>
              {info.clientName ? (
                <input type="radio" name="conta" aria-label={`Escolher @${c.username}`} checked={picks.unica === c.igUserId} onChange={() => setPicks({ unica: c.igUserId })} className="size-5 accent-rosa-forte" />
              ) : (
                <select
                  aria-label={`Cliente de @${c.username}`}
                  value={picks[c.igUserId] ?? ""}
                  onChange={(e) => setPicks((p) => ({ ...p, [c.igUserId]: e.target.value }))}
                  className="min-h-10 rounded-full border border-campo bg-white pl-3 pr-8 text-sm"
                >
                  <option value="">Não é cliente</option>
                  {info.clients.map((cl) => (
                    <option key={cl.slug} value={cl.slug}>{cl.name}</option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ul>
        {message && <p role="alert" className="text-sm font-semibold text-st-ajuste-texto">{message}</p>}
        <button type="button" disabled={busy} onClick={save} className={`${buttonClass.primary} self-start`}>
          {busy ? "Salvando" : "Salvar"}
        </button>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-lg leading-relaxed text-texto-3">
          {info.clientName
            ? <>O estúdio vai acompanhar as métricas do Instagram de <strong>{info.clientName}</strong> (alcance, visualizações, salvamentos e compartilhamentos) para montar o relatório. Ninguém posta nada nem lê suas mensagens.</>
            : "Entre com o seu Facebook. O Hub mostra os Instagrams das Páginas que você administra e você escolhe qual é de cada cliente."}
        </p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] text-texto-3">
          <li>O Instagram precisa ser profissional e estar ligado a uma Página do Facebook.</li>
          <li>No login, deixe marcadas as Páginas e o Instagram que devem ser acompanhados.</li>
        </ul>
        <a href={info.authUrl} className={`${buttonClass.primary} self-start`}>
          Entrar com o Facebook
        </a>
      </>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <section className="grade-rosa px-6 pb-12 pt-8">
        <div className="mx-auto flex max-w-lg flex-col gap-10">
          <Logo className="text-[19px] text-white" />
          <h1 className="titulo flex items-center gap-3 text-[46px] text-white md:text-[56px]">
            {title}
            <Asterisk size={40} color="var(--color-vinho)" />
          </h1>
        </div>
      </section>
      <section className="mx-auto flex w-full max-w-lg flex-col gap-5 px-6 py-10">{body}</section>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Conectar />
    </Suspense>
  );
}
