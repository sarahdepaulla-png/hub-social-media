import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin, requireClientBySlug, requireViewer, getViewer } from "./lib/access";
import { alive, contentsInMonth } from "./lib/content";
import { logActivity } from "./lib/log";

/**
 * Plano do mês: a página que mostra o mês inteiro como um vision board (tema, objetivos,
 * caminho em fases, mix, calendário e feed) para a cliente aprovar a direção.
 * As peças vêm do calendário; o plano guarda só a camada de estratégia.
 */

const MONTH = /^\d{4}-\d{2}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

const goalV = v.object({ title: v.string(), how: v.optional(v.string()) });
const phaseV = v.object({
  name: v.string(),
  start: v.string(),
  end: v.string(),
  intent: v.optional(v.string()),
  stories: v.optional(v.string()),
});
const needV = v.object({ text: v.string(), due: v.optional(v.string()), done: v.boolean() });
const pieceV = v.object({
  contentId: v.id("contents"),
  hook: v.optional(v.string()),
  note: v.optional(v.string()),
  essential: v.optional(v.boolean()),
});
const highlightV = v.object({ title: v.string(), text: v.optional(v.string()), pillar: v.string() });

const clip = (s: string | undefined, n: number) => {
  const t = (s ?? "").trim();
  return t ? t.slice(0, n) : undefined;
};

function checkMonth(month: string) {
  if (!MONTH.test(month)) throw new ConvexError("Mês inválido.");
}

async function findPlan(ctx: { db: QueryCtx["db"] }, clientId: Id<"clients">, month: string) {
  return await ctx.db
    .query("monthPlans")
    .withIndex("by_client_month", (q) => q.eq("clientId", clientId).eq("month", month))
    .first();
}

function emptyPlan(clientId: Id<"clients">, month: string) {
  return {
    clientId,
    month,
    theme: "",
    palette: [] as string[],
    moodPhrases: [] as string[],
    moodIds: [] as Id<"_storage">[],
    goals: [] as { title: string; how?: string }[],
    phases: [] as Doc<"monthPlans">["phases"],
    needs: [] as Doc<"monthPlans">["needs"],
    pieces: [] as Doc<"monthPlans">["pieces"],
    status: "rascunho" as const,
    updatedAt: Date.now(),
  };
}

/** Tudo o que a página precisa: o plano (se houver), as peças do mês e o fim do feed atual. */
export const get = query({
  args: { slug: v.string(), month: v.string() },
  handler: async (ctx, { slug, month }) => {
    checkMonth(month);
    const { viewer, client } = await requireClientBySlug(ctx, slug);
    const admin = viewer.role === "admin";
    const plan = await findPlan(ctx, client._id, month);
    const visible = plan && (admin || plan.status !== "rascunho") ? plan : null;

    // Meses com plano, para a navegação (a cliente só vê os enviados).
    const months = (
      await ctx.db
        .query("monthPlans")
        .withIndex("by_client_month", (q) => q.eq("clientId", client._id))
        .collect()
    )
      .filter((p) => admin || p.status !== "rascunho")
      .map((p) => ({ month: p.month, status: p.status }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const notes = new Map((visible?.pieces ?? []).map((p) => [p.contentId, p]));
    const contents = (await contentsInMonth(ctx, client._id, month))
      .filter(alive)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
    const pieces = await Promise.all(
      contents.map(async (c) => {
        const n = notes.get(c._id);
        return {
          _id: c._id,
          date: c.date,
          title: c.title,
          format: c.format,
          platform: c.platform,
          status: c.status,
          pillar: c.pillar ?? null,
          objective: c.objective ?? null,
          coverUrl: c.coverId ? await ctx.storage.getUrl(c.coverId) : (c.coverUrl ?? null),
          hook: n?.hook ?? null,
          note: n?.note ?? null,
          essential: n?.essential === true,
        };
      }),
    );

    // Os posts mais recentes que já estão no perfil, para a grade continuar depois das peças novas.
    const feedTail = await Promise.all(
      (
        await ctx.db
          .query("feedPosts")
          .withIndex("by_client", (q) => q.eq("clientId", client._id))
          .collect()
      )
        .filter((p) => !p.pinnedAt)
        .sort((a, b) => a.position - b.position)
        .slice(0, 6)
        .map(async (p) => ({ _id: p._id, url: await ctx.storage.getUrl(p.storageId) })),
    );

    const people = admin
      ? (await ctx.db.query("invites").collect())
          .filter((i) => i.clientId === client._id && i.role === "cliente" && i.token)
          .map((i) => ({ name: i.name ?? i.email.split("@")[0], token: i.token! }))
      : [];

    return {
      isAdmin: admin,
      // "Ver como cliente": existe rascunho que a cliente ainda não vê.
      hiddenDraft: !admin && !!plan && plan.status === "rascunho" && !!(viewer as { viewingAs?: boolean }).viewingAs,
      canDecide: viewer.role === "cliente" && !(viewer as { viewingAs?: boolean }).viewingAs,
      client: {
        name: client.name,
        accentColor: client.accentColor,
        instagram: client.instagram ?? null,
        bio: client.igProfile?.bio ?? client.description ?? null,
        photoUrl: client.photoId ? await ctx.storage.getUrl(client.photoId) : null,
      },
      months,
      plan: visible
        ? {
            _id: visible._id,
            theme: visible.theme,
            concept: visible.concept ?? null,
            mood: visible.mood ?? null,
            palette: visible.palette,
            moodPhrases: visible.moodPhrases,
            moodImages: await Promise.all(
              visible.moodIds.map(async (id) => ({ id, url: await ctx.storage.getUrl(id) })),
            ),
            goals: visible.goals,
            phases: visible.phases,
            highlight: visible.highlight ?? null,
            needs: visible.needs,
            status: visible.status,
            sentAt: visible.sentAt ?? null,
            readyMail: admin ? (visible.readyMail ?? null) : null,
            decision: visible.decision ?? null,
          }
        : null,
      pieces,
      feedTail,
      whatsapp: admin ? (client.whatsapp ?? null) : null,
      people,
    };
  },
});

/** Planos esperando a cliente (para o aviso na página Aprovar). */
export const pending = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { viewer, client } = await requireClientBySlug(ctx, slug);
    const admin = viewer.role === "admin";
    // A admin também vê o rascunho na entrada, para lembrar de enviar.
    return (
      await ctx.db
        .query("monthPlans")
        .withIndex("by_client_month", (q) => q.eq("clientId", client._id))
        .collect()
    )
      .filter((p) => p.status === "aguardando" || (admin && p.status === "rascunho"))
      .map((p) => ({ month: p.month, theme: p.theme, status: p.status }));
  },
});

/** A admin salva o plano inteiro (cria se ainda não existe). */
export const save = mutation({
  args: {
    slug: v.string(),
    month: v.string(),
    theme: v.string(),
    concept: v.optional(v.string()),
    mood: v.optional(v.string()),
    palette: v.array(v.string()),
    moodPhrases: v.array(v.string()),
    goals: v.array(goalV),
    phases: v.array(phaseV),
    highlight: v.optional(v.union(highlightV, v.null())),
    needs: v.array(needV),
    pieces: v.array(pieceV),
  },
  handler: async (ctx, args) => {
    checkMonth(args.month);
    await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, args.slug);
    const theme = args.theme.trim().slice(0, 140);
    if (!theme) throw new ConvexError("Escreva o tema do mês.");
    for (const ph of args.phases) {
      if (!DAY.test(ph.start) || !DAY.test(ph.end)) throw new ConvexError(`Confira as datas da fase "${ph.name}".`);
      if (ph.end < ph.start) throw new ConvexError(`A fase "${ph.name}" termina antes de começar.`);
    }
    // Só peças desta cliente.
    for (const p of args.pieces) {
      const c = await ctx.db.get(p.contentId);
      if (!c || c.clientId !== client._id) throw new ConvexError("Peça de outra cliente no plano.");
    }
    const fields = {
      theme,
      concept: clip(args.concept, 1200),
      mood: clip(args.mood, 120),
      palette: args.palette.map((c) => c.trim()).filter((c) => HEX.test(c)).slice(0, 8),
      moodPhrases: args.moodPhrases.map((t) => t.trim().slice(0, 120)).filter(Boolean).slice(0, 6),
      goals: args.goals
        .map((g) => ({ title: g.title.trim().slice(0, 120), how: clip(g.how, 300) }))
        .filter((g) => g.title)
        .slice(0, 6),
      phases: args.phases
        .map((p) => ({ name: p.name.trim().slice(0, 40), start: p.start, end: p.end, intent: clip(p.intent, 400), stories: clip(p.stories, 600) }))
        .filter((p) => p.name)
        .slice(0, 6),
      highlight: args.highlight && args.highlight.title.trim() && args.highlight.pillar.trim()
        ? { title: args.highlight.title.trim().slice(0, 80), text: clip(args.highlight.text, 500), pillar: args.highlight.pillar.trim() }
        : undefined,
      needs: args.needs
        .map((n) => ({ text: n.text.trim().slice(0, 200), due: clip(n.due, 40), done: n.done }))
        .filter((n) => n.text)
        .slice(0, 20),
      pieces: args.pieces.map((p) => ({
        contentId: p.contentId,
        hook: clip(p.hook, 140),
        note: clip(p.note, 600),
        essential: p.essential === true ? true : undefined,
      })),
      updatedAt: Date.now(),
    };
    const existing = await findPlan(ctx, client._id, args.month);
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("monthPlans", { ...emptyPlan(client._id, args.month), ...fields });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Imagem no moodboard (a admin sobe; até 8). */
export const addMoodImage = mutation({
  args: { slug: v.string(), month: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, { slug, month, storageId }) => {
    checkMonth(month);
    await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, slug);
    const plan = await findPlan(ctx, client._id, month);
    if (!plan) {
      await ctx.db.insert("monthPlans", { ...emptyPlan(client._id, month), theme: "Plano do mês", moodIds: [storageId] });
      return;
    }
    if (plan.moodIds.length >= 8) {
      await ctx.storage.delete(storageId);
      throw new ConvexError("O moodboard aceita até 8 imagens.");
    }
    await ctx.db.patch(plan._id, { moodIds: [...plan.moodIds, storageId], updatedAt: Date.now() });
  },
});

export const removeMoodImage = mutation({
  args: { slug: v.string(), month: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, { slug, month, storageId }) => {
    await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, slug);
    const plan = await findPlan(ctx, client._id, month);
    if (!plan || !plan.moodIds.includes(storageId)) return;
    await ctx.db.patch(plan._id, { moodIds: plan.moodIds.filter((id) => id !== storageId), updatedAt: Date.now() });
    await ctx.storage.delete(storageId);
  },
});

/** A admin manda o plano para a cliente (ou volta para rascunho). */
export const setStatus = mutation({
  args: { slug: v.string(), month: v.string(), status: v.union(v.literal("rascunho"), v.literal("aguardando")) },
  handler: async (ctx, { slug, month, status }) => {
    await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, slug);
    const plan = await findPlan(ctx, client._id, month);
    if (!plan) throw new ConvexError("Monte o plano antes de enviar.");
    if (status === "aguardando" && !plan.theme.trim()) throw new ConvexError("Escreva o tema do mês antes de enviar.");
    await ctx.db.patch(plan._id, {
      status,
      sentAt: status === "aguardando" ? Date.now() : plan.sentAt,
      decision: status === "aguardando" ? undefined : plan.decision,
      updatedAt: Date.now(),
    });
    // Enviou: a cliente recebe o e-mail com o link pessoal direto para o plano.
    if (status === "aguardando") await ctx.scheduler.runAfter(0, internal.mailer.sendPlanReady, { planId: plan._id });
  },
});

/** A cliente aprova o plano ou pede ajuste. */
export const decide = mutation({
  args: { slug: v.string(), month: v.string(), type: v.union(v.literal("aprovado"), v.literal("ajuste")), comment: v.optional(v.string()) },
  handler: async (ctx, { slug, month, type, comment }) => {
    const viewer = await getViewer(ctx);
    if (viewer?.viewingAs) throw new ConvexError("Você está vendo como a cliente. Só ela pode aprovar.");
    const { viewer: who, client } = await requireClientBySlug(ctx, slug);
    if (who.role !== "cliente") throw new ConvexError("Só a cliente aprova o plano.");
    const plan = await findPlan(ctx, client._id, month);
    if (!plan || plan.status === "rascunho") throw new ConvexError("Plano não encontrado.");
    const text = clip(comment, 1500);
    if (type === "ajuste" && !text) throw new ConvexError("Conte o que você quer mudar.");
    await ctx.db.patch(plan._id, {
      status: type,
      decision: { userId: who._id, name: who.name ?? who.email?.split("@")[0] ?? "Cliente", at: Date.now(), comment: text },
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      clientId: client._id,
      userId: who._id,
      kind: "decisao",
      summary: type === "aprovado" ? `Aprovou o plano de ${month}` : `Pediu ajuste no plano de ${month}`,
    });
    // Aprovado: as peças do plano saem de "Ideia" e entram no calendário do mês como "Em produção".
    let promoted = 0;
    if (type === "aprovado") {
      const inPlan = new Set(plan.pieces.map((p) => p.contentId));
      for (const c of await contentsInMonth(ctx, client._id, month)) {
        if (c.status !== "ideia" || (inPlan.size > 0 && !inPlan.has(c._id))) continue;
        await ctx.db.patch(c._id, { status: "producao" });
        await logActivity(ctx, { clientId: client._id, contentId: c._id, userId: who._id, kind: "status", summary: "Entrou no calendário com a aprovação do plano do mês" });
        promoted++;
      }
    }
    // Aviso por e-mail para o estúdio.
    await ctx.scheduler.runAfter(0, internal.mailer.sendPlanDecision, { planId: plan._id, promoted });
  },
});

/** A admin manda (de novo) o e-mail "seu plano está pronto" para a cliente. */
export const resendReadyMail = mutation({
  args: { slug: v.string(), month: v.string() },
  handler: async (ctx, { slug, month }) => {
    await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, slug);
    const plan = await findPlan(ctx, client._id, month);
    if (!plan || plan.status !== "aguardando") throw new ConvexError("Envie o plano para a cliente primeiro.");
    await ctx.db.patch(plan._id, { readyMail: undefined });
    await ctx.scheduler.runAfter(0, internal.mailer.sendPlanReady, { planId: plan._id });
  },
});

/** Quem recebe o e-mail do plano: as pessoas da cliente, com o link pessoal de cada uma. */
export const readyData = internalQuery({
  args: { planId: v.id("monthPlans") },
  handler: async (ctx, { planId }) => {
    const plan = await ctx.db.get(planId);
    if (!plan || plan.status !== "aguardando") return null;
    const client = await ctx.db.get(plan.clientId);
    if (!client) return null;
    const people = new Map<string, { email: string; name: string | null; token: string | null }>();
    for (const u of await ctx.db.query("users").collect()) {
      if (u.role === "cliente" && u.clientId === client._id && u.email) people.set(u.email.toLowerCase(), { email: u.email, name: u.name ?? null, token: null });
    }
    for (const i of await ctx.db.query("invites").collect()) {
      if (i.clientId !== client._id || i.role !== "cliente") continue;
      const prev = people.get(i.email.toLowerCase());
      people.set(i.email.toLowerCase(), { email: i.email, name: prev?.name ?? i.name ?? null, token: i.token ?? null });
    }
    const admin = (await ctx.db.query("users").collect()).find((u) => u.role === "admin" && u.name);
    const count = (await contentsInMonth(ctx, client._id, plan.month)).length;
    return {
      client: { name: client.name, slug: client.slug },
      month: plan.month,
      theme: plan.theme,
      count,
      recipients: [...people.values()],
      adminName: admin?.name ?? null,
    };
  },
});

export const markReadyMail = internalMutation({
  args: { planId: v.id("monthPlans"), to: v.optional(v.array(v.string())), error: v.optional(v.string()) },
  handler: async (ctx, { planId, to, error }) => {
    await ctx.db.patch(planId, { readyMail: { at: Date.now(), to, error } });
  },
});

/** Dados do e-mail "a cliente decidiu o plano". */
export const decisionData = internalQuery({
  args: { planId: v.id("monthPlans") },
  handler: async (ctx, { planId }) => {
    const plan = await ctx.db.get(planId);
    if (!plan || !plan.decision) return null;
    const client = await ctx.db.get(plan.clientId);
    if (!client) return null;
    const fromEnv = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
    const fromUsers = (await ctx.db.query("users").collect()).filter((u) => u.role === "admin" && u.email).map((u) => u.email!);
    return {
      to: [...new Set([...fromEnv, ...fromUsers].map((e) => e.toLowerCase()))],
      client: { name: client.name, slug: client.slug },
      month: plan.month,
      theme: plan.theme,
      status: plan.status,
      decision: plan.decision,
    };
  },
});

/** Marcar ou desmarcar uma pendência ("o que preciso de você"): cliente e admin. */
export const toggleNeed = mutation({
  args: { slug: v.string(), month: v.string(), index: v.number() },
  handler: async (ctx, { slug, month, index }) => {
    await requireViewer(ctx);
    const viewer = await getViewer(ctx);
    if (viewer?.viewingAs) throw new ConvexError("Você está vendo como a cliente.");
    const { viewer: who, client } = await requireClientBySlug(ctx, slug);
    const plan = await findPlan(ctx, client._id, month);
    if (!plan || (who.role !== "admin" && plan.status === "rascunho")) throw new ConvexError("Plano não encontrado.");
    const needs = plan.needs.map((n, i) => (i === index ? { ...n, done: !n.done } : n));
    await ctx.db.patch(plan._id, { needs, updatedAt: Date.now() });
  },
});

/**
 * Fila de planos (pasta planos/): cria ou atualiza o plano a cada publicação.
 * Peças citadas pela chave da fila de conteúdo. Plano já enviado à cliente não é sobrescrito.
 */
export const apply = internalMutation({
  args: {
    plan: v.object({
      key: v.string(),
      client: v.string(),
      month: v.string(),
      theme: v.string(),
      concept: v.optional(v.string()),
      mood: v.optional(v.string()),
      palette: v.optional(v.array(v.string())),
      moodPhrases: v.optional(v.array(v.string())),
      goals: v.optional(v.array(goalV)),
      phases: v.optional(v.array(phaseV)),
      highlight: v.optional(highlightV),
      needs: v.optional(v.array(v.object({ text: v.string(), due: v.optional(v.string()) }))),
      pieces: v.optional(
        v.array(v.object({ key: v.string(), hook: v.optional(v.string()), note: v.optional(v.string()), essential: v.optional(v.boolean()) })),
      ),
    }),
  },
  handler: async (ctx, { plan: it }) => {
    checkMonth(it.month);
    const client = await ctx.db
      .query("clients")
      .withIndex("by_slug", (q) => q.eq("slug", it.client))
      .first();
    if (!client) return `${it.key}: cliente "${it.client}" não existe, pulei`;
    const existing = await findPlan(ctx, client._id, it.month);
    if (existing && existing.importKey !== it.key) return `${it.key}: já existe um plano feito na tela, não mexi`;
    if (existing && existing.status !== "rascunho") return `${it.key}: já enviado à cliente, não mexi`;

    const pieces: Doc<"monthPlans">["pieces"] = [];
    for (const p of it.pieces ?? []) {
      const c = await ctx.db
        .query("contents")
        .withIndex("by_import_key", (q) => q.eq("importKey", p.key))
        .first();
      if (c && c.clientId === client._id) pieces.push({ contentId: c._id, hook: p.hook, note: p.note, essential: p.essential });
    }
    const fields = {
      theme: it.theme,
      concept: it.concept,
      mood: it.mood,
      palette: (it.palette ?? []).filter((c) => HEX.test(c)),
      moodPhrases: it.moodPhrases ?? [],
      goals: it.goals ?? [],
      phases: it.phases ?? [],
      highlight: it.highlight,
      needs: (it.needs ?? []).map((n) => ({ ...n, done: false })),
      pieces,
      importKey: it.key,
      updatedAt: Date.now(),
    };
    if (existing) {
      // Mantém as pendências já marcadas.
      const done = new Set(existing.needs.filter((n) => n.done).map((n) => n.text));
      await ctx.db.patch(existing._id, { ...fields, needs: fields.needs.map((n) => ({ ...n, done: done.has(n.text) })) });
      return `${it.key}: atualizado`;
    }
    await ctx.db.insert("monthPlans", { ...emptyPlan(client._id, it.month), ...fields });
    return `${it.key}: criado`;
  },
});
