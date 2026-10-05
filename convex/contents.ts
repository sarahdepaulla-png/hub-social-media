import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin, requireClientBySlug, requireContentAccess } from "./lib/access";
import { displayName, logActivity } from "./lib/log";
import { UNDO_WINDOW_MS } from "./lib/content";
import { decisionType, format, platform, status } from "./schema";


const STATUS_LABEL: Record<Doc<"contents">["status"], string> = {
  ideia: "Ideia",
  producao: "Em produção",
  aguardando: "Aguardando aprovação",
  ajuste: "Ajuste solicitado",
  aprovado: "Aprovado",
  agendado: "Agendado",
  publicado: "Publicado",
};

const DECISION_LABEL: Record<Doc<"decisions">["type"], string> = {
  aprovar: "Aprovado",
  aprovar_obs: "Aprovado com observação",
  ajuste: "Ajuste solicitado",
};

/** A peça completa, do jeito que a tela de Conteúdo precisa. */
export const get = query({
  args: { contentId: v.id("contents") },
  handler: async (ctx, { contentId }) => {
    const { viewer, content, client } = await requireContentAccess(ctx, contentId);

    const media = await ctx.db
      .query("media")
      .withIndex("by_content_version", (q) => q.eq("contentId", contentId).eq("version", content.version))
      .collect();
    const mediaOut = await Promise.all(
      media.map(async (m) => ({
        _id: m._id,
        order: m.order,
        kind: m.kind,
        alt: m.alt ?? null,
        url: m.storageId ? await ctx.storage.getUrl(m.storageId) : (m.url ?? null),
      })),
    );

    const captions = await ctx.db
      .query("captions")
      .withIndex("by_content", (q) => q.eq("contentId", contentId))
      .collect();

    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_content", (q) => q.eq("contentId", contentId))
      .order("desc")
      .collect();
    const lastDecision = decisions.find((d) => !d.undoneAt && d.version === content.version) ?? null;
    const decisionUser = lastDecision ? await ctx.db.get(lastDecision.userId) : null;

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_content", (q) => q.eq("contentId", contentId))
      .collect();
    const authors = new Map<string, Doc<"users"> | null>();
    for (const c of comments) {
      if (!authors.has(c.authorId)) authors.set(c.authorId, await ctx.db.get(c.authorId));
    }

    // Próxima peça esperando decisão, para o botão "Ver o próximo".
    const waiting = await ctx.db
      .query("contents")
      .withIndex("by_client_status", (q) => q.eq("clientId", client._id).eq("status", "aguardando"))
      .collect();
    const queue = waiting.filter((c) => c._id !== contentId).sort((a, b) => a.date.localeCompare(b.date));

    return {
      viewer: { _id: viewer._id, role: viewer.role! },
      client: { slug: client.slug, name: client.name, accentColor: client.accentColor },
      content: {
        _id: content._id,
        date: content.date,
        time: content.time ?? null,
        platform: content.platform,
        format: content.format,
        title: content.title,
        objective: content.objective ?? null,
        pillar: content.pillar ?? null,
        status: content.status,
        version: content.version,
        externalUrl: content.externalUrl ?? null,
        coverUrl: content.coverId ? await ctx.storage.getUrl(content.coverId) : (content.coverUrl ?? null),
        coverSource: content.coverSource ?? null,
      },
      media: mediaOut.sort((a, b) => a.order - b.order),
      captions: captions
        .sort((a, b) => a.order - b.order)
        .map((c) => ({
          _id: c._id,
          order: c.order,
          text: c.text,
          cta: c.cta ?? null,
          hashtags: c.hashtags ?? null,
          notes: c.notes ?? null,
          chosen: !!c.chosenBy,
        })),
      decision: lastDecision && {
        _id: lastDecision._id,
        type: lastDecision.type,
        label: DECISION_LABEL[lastDecision.type],
        comment: lastDecision.comment ?? null,
        at: lastDecision._creationTime,
        userName: displayName(decisionUser),
        isMine: lastDecision.userId === viewer._id,
      },
      comments: comments.map((c) => {
        const author = authors.get(c.authorId) ?? null;
        return {
          _id: c._id,
          parentId: c.parentId ?? null,
          body: c.body,
          at: c._creationTime,
          mediaOrder: c.mediaOrder ?? null,
          decisionLabel: c.decisionId ? (DECISION_LABEL[decisions.find((d) => d._id === c.decisionId)?.type ?? "aprovar"] ?? null) : null,
          author: { name: displayName(author), role: author?.role ?? "cliente" },
          isMine: c.authorId === viewer._id,
        };
      }),
      queue: { remaining: queue.length, nextId: queue[0]?._id ?? null },
    };
  },
});

/** Histórico da peça: alterações, decisões, comentários, versões. */
export const history = query({
  args: { contentId: v.id("contents") },
  handler: async (ctx, { contentId }) => {
    await requireContentAccess(ctx, contentId);
    const items = await ctx.db
      .query("activity")
      .withIndex("by_content", (q) => q.eq("contentId", contentId))
      .order("desc")
      .take(100);
    const out = [];
    for (const a of items) {
      const user = await ctx.db.get(a.userId);
      out.push({ _id: a._id, kind: a.kind, summary: a.summary, at: a._creationTime, userName: displayName(user) });
    }
    return out;
  },
});

/** Aprovar, aprovar com observação ou solicitar ajuste. Tudo fica registrado. */
export const decide = mutation({
  args: { contentId: v.id("contents"), type: decisionType, comment: v.optional(v.string()), mediaOrder: v.optional(v.number()) },
  handler: async (ctx, { contentId, type, comment, mediaOrder }) => {
    const { viewer, content } = await requireContentAccess(ctx, contentId);
    if (content.status !== "aguardando") {
      throw new ConvexError("Esta peça não está esperando decisão.");
    }
    const text = comment?.trim() || undefined;
    if (type !== "aprovar" && !text) {
      throw new ConvexError(type === "ajuste" ? "Conte o que precisa mudar." : "Escreva a sua observação.");
    }
    const next: Doc<"contents">["status"] = type === "ajuste" ? "ajuste" : "aprovado";

    const decisionId = await ctx.db.insert("decisions", {
      contentId,
      clientId: content.clientId,
      version: content.version,
      type,
      comment: text,
      userId: viewer._id,
      previousStatus: content.status,
    });
    await ctx.db.patch(contentId, { status: next });
    if (text) {
      await ctx.db.insert("comments", {
        contentId,
        clientId: content.clientId,
        authorId: viewer._id,
        body: text,
        decisionId,
        mediaOrder,
      });
    }
    await logActivity(ctx, {
      clientId: content.clientId,
      contentId,
      userId: viewer._id,
      kind: "decisao",
      summary: `${DECISION_LABEL[type]} na versão ${content.version}${text ? `: "${text}"` : ""}`,
      before: content.status,
      after: next,
    });
    return { decisionId };
  },
});

/** Desfazer a própria decisão nos primeiros 10 minutos. */
export const undoDecision = mutation({
  args: { decisionId: v.id("decisions") },
  handler: async (ctx, { decisionId }) => {
    const decision = await ctx.db.get(decisionId);
    if (!decision) throw new ConvexError("Decisão não encontrada.");
    const { viewer, content } = await requireContentAccess(ctx, decision.contentId);
    if (decision.userId !== viewer._id) throw new ConvexError("Só quem decidiu pode desfazer.");
    if (decision.undoneAt) return;
    if (Date.now() - decision._creationTime > UNDO_WINDOW_MS) {
      throw new ConvexError("Passou o tempo para desfazer. Comente na peça e o estúdio ajusta.");
    }
    if (content.version !== decision.version) throw new ConvexError("O estúdio já subiu outra versão.");

    await ctx.db.patch(decisionId, { undoneAt: Date.now() });
    await ctx.db.patch(content._id, { status: decision.previousStatus ?? "aguardando" });
    const linked = await ctx.db
      .query("comments")
      .withIndex("by_content", (q) => q.eq("contentId", content._id))
      .collect();
    for (const c of linked.filter((c) => c.decisionId === decisionId)) await ctx.db.delete(c._id);
    await logActivity(ctx, {
      clientId: content.clientId,
      contentId: content._id,
      userId: viewer._id,
      kind: "decisao",
      summary: `Desfez "${DECISION_LABEL[decision.type]}"`,
    });
  },
});

export const chooseCaption = mutation({
  args: { captionId: v.id("captions") },
  handler: async (ctx, { captionId }) => {
    const caption = await ctx.db.get(captionId);
    if (!caption) throw new ConvexError("Legenda não encontrada.");
    const { viewer, content } = await requireContentAccess(ctx, caption.contentId);
    if (caption.chosenBy) return;
    const all = await ctx.db
      .query("captions")
      .withIndex("by_content", (q) => q.eq("contentId", caption.contentId))
      .collect();
    for (const c of all) {
      if (c._id === captionId) await ctx.db.patch(c._id, { chosenBy: viewer._id, chosenAt: Date.now() });
      else if (c.chosenBy) await ctx.db.patch(c._id, { chosenBy: undefined, chosenAt: undefined });
    }
    await logActivity(ctx, {
      clientId: content.clientId,
      contentId: content._id,
      userId: viewer._id,
      kind: "legenda",
      summary: `Escolheu a legenda opção ${caption.order}`,
    });
  },
});

/* ---------- Admin ---------- */

const editable = {
  date: v.optional(v.string()),
  time: v.optional(v.string()),
  platform: v.optional(platform),
  format: v.optional(format),
  title: v.optional(v.string()),
  objective: v.optional(v.string()),
  pillar: v.optional(v.string()),
  externalUrl: v.optional(v.string()),
};

const FIELD_LABEL: Record<string, string> = {
  date: "data",
  time: "horário",
  platform: "plataforma",
  format: "formato",
  title: "tema",
  objective: "objetivo",
  pillar: "pilar",
  externalUrl: "link",
};

export const create = mutation({
  args: {
    clientSlug: v.string(),
    date: v.string(),
    title: v.string(),
    platform,
    format,
    sourceIdeaId: v.optional(v.id("ideas")),
    sourceOpportunityId: v.optional(v.id("opportunities")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, args.clientSlug);
    const contentId = await ctx.db.insert("contents", {
      clientId: client._id,
      date: args.date,
      title: args.title.trim() || "Sem título",
      platform: args.platform,
      format: args.format,
      status: "producao",
      version: 1,
      sourceIdeaId: args.sourceIdeaId,
      sourceOpportunityId: args.sourceOpportunityId,
    });
    let origin = "";
    if (args.sourceIdeaId) {
      const idea = await ctx.db.get(args.sourceIdeaId);
      if (idea && idea.clientId === client._id) {
        await ctx.db.patch(idea._id, { status: "convertida", contentId });
        origin = ` a partir da ideia "${idea.title}"`;
      }
    } else if (args.sourceOpportunityId) {
      const opp = await ctx.db.get(args.sourceOpportunityId);
      if (opp) origin = ` a partir da data "${opp.title}"`;
      // Pedido da cliente sobre esta data vira "convertida" também.
      const asked = await ctx.db
        .query("ideas")
        .withIndex("by_client", (q) => q.eq("clientId", client._id))
        .collect();
      for (const i of asked.filter((i) => i.opportunityId === args.sourceOpportunityId && i.status !== "convertida")) {
        await ctx.db.patch(i._id, { status: "convertida", contentId });
      }
    }
    await logActivity(ctx, { clientId: client._id, contentId, userId: admin._id, kind: "criacao", summary: `Criou o conteúdo${origin}` });
    return contentId;
  },
});

export const update = mutation({
  args: { contentId: v.id("contents"), ...editable },
  handler: async (ctx, { contentId, ...patch }) => {
    const admin = await requireAdmin(ctx);
    const content = await ctx.db.get(contentId);
    if (!content) throw new ConvexError("Conteúdo não encontrado.");
    const changed = Object.entries(patch).filter(
      ([k, val]) => val !== undefined && content[k as keyof typeof content] !== val,
    );
    if (changed.length === 0) return;
    await ctx.db.patch(contentId, Object.fromEntries(changed));
    await logActivity(ctx, {
      clientId: content.clientId,
      contentId,
      userId: admin._id,
      kind: "edicao",
      summary: `Alterou ${changed.map(([k]) => FIELD_LABEL[k] ?? k).join(", ")}`,
      before: Object.fromEntries(changed.map(([k]) => [k, content[k as keyof typeof content]])),
      after: Object.fromEntries(changed),
    });
  },
});

export const setStatus = mutation({
  args: { contentId: v.id("contents"), status },
  handler: async (ctx, { contentId, status: next }) => {
    const admin = await requireAdmin(ctx);
    const content = await ctx.db.get(contentId);
    if (!content) throw new ConvexError("Conteúdo não encontrado.");
    if (content.status === next) return;
    if (next === "aguardando") await assertReady(ctx, content);
    await ctx.db.patch(contentId, { status: next });
    await logActivity(ctx, {
      clientId: content.clientId,
      contentId,
      userId: admin._id,
      kind: "status",
      summary: `Status: ${STATUS_LABEL[content.status]} para ${STATUS_LABEL[next]}`,
      before: content.status,
      after: next,
    });
  },
});

/** Só manda para aprovação o que tem algo para ver. */
async function assertReady(ctx: MutationCtx, content: Doc<"contents">) {
  const media = await ctx.db
    .query("media")
    .withIndex("by_content_version", (q) => q.eq("contentId", content._id).eq("version", content.version))
    .first();
  if (!media && !content.externalUrl) {
    throw new ConvexError("Adicione ao menos uma mídia ou um link antes de enviar para aprovação.");
  }
}

/** Nova versão depois de um ajuste. A anterior fica guardada. */
export const newVersion = mutation({
  args: { contentId: v.id("contents"), copyMedia: v.boolean() },
  handler: async (ctx, { contentId, copyMedia }) => {
    const admin = await requireAdmin(ctx);
    const content = await ctx.db.get(contentId);
    if (!content) throw new ConvexError("Conteúdo não encontrado.");
    const version = content.version + 1;
    if (copyMedia) {
      const media = await ctx.db
        .query("media")
        .withIndex("by_content_version", (q) => q.eq("contentId", contentId).eq("version", content.version))
        .collect();
      for (const { _id, _creationTime, ...m } of media) {
        void _id;
        void _creationTime;
        await ctx.db.insert("media", { ...m, version });
      }
    }
    await ctx.db.patch(contentId, { version, status: "producao" });
    await logActivity(ctx, {
      clientId: content.clientId,
      contentId,
      userId: admin._id,
      kind: "versao",
      summary: `Abriu a versão ${version}`,
    });
    return version;
  },
});

export const remove = mutation({
  args: { contentId: v.id("contents") },
  handler: async (ctx, { contentId }) => {
    await requireAdmin(ctx);
    const content = await ctx.db.get(contentId);
    if (!content) return;
    const rows: { _id: Id<"media"> | Id<"captions"> | Id<"comments"> | Id<"decisions"> }[] = [
      ...(await ctx.db.query("media").withIndex("by_content_version", (q) => q.eq("contentId", contentId)).collect()),
      ...(await ctx.db.query("captions").withIndex("by_content", (q) => q.eq("contentId", contentId)).collect()),
      ...(await ctx.db.query("comments").withIndex("by_content", (q) => q.eq("contentId", contentId)).collect()),
      ...(await ctx.db.query("decisions").withIndex("by_content", (q) => q.eq("contentId", contentId)).collect()),
    ];
    for (const r of rows) await ctx.db.delete(r._id);
    if (content.coverId && (content.coverSource === "manual" || content.coverSource === "quadro")) {
      await ctx.storage.delete(content.coverId);
    }
    await ctx.db.delete(contentId);
  },
});
