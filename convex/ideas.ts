import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin, requireClientBySlug, requireViewer } from "./lib/access";
import { displayName, logActivity } from "./lib/log";
import { platformOf, siteName } from "./lib/preview";

/** Mural de ideias e referências do workspace, mais recentes primeiro. */
export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { viewer, client } = await requireClientBySlug(ctx, slug);
    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .order("desc")
      .collect();
    const out = [];
    for (const i of ideas) {
      if (i.status === "arquivada" && viewer.role !== "admin") continue;
      const author = await ctx.db.get(i.authorId);
      const content = i.contentId ? await ctx.db.get(i.contentId) : null;
      const file = i.fileId ? await ctx.db.system.get(i.fileId) : null;
      const fileUrl = i.fileId ? await ctx.storage.getUrl(i.fileId) : null;
      const fileIsImage = !!file?.contentType?.startsWith("image/");
      out.push({
        _id: i._id,
        title: i.title,
        description: i.description ?? null,
        adaptation: i.adaptation ?? null,
        link: i.link ?? null,
        platform: i.link ? platformOf(i.link) : null,
        site: i.link ? siteName(i.link) : null,
        // A imagem do cartão: print enviado, senão a prévia tirada do link.
        imageUrl: fileIsImage ? fileUrl : i.previewId ? await ctx.storage.getUrl(i.previewId) : null,
        previewTitle: i.previewTitle ?? null,
        previewPending: i.previewStatus === "pendente",
        fileUrl: fileIsImage ? null : fileUrl,
        status: i.status,
        at: i._creationTime,
        authorName: displayName(author),
        authorIsStudio: author?.role === "admin",
        isMine: i.authorId === viewer._id,
        canEdit: viewer.role === "admin" || i.authorId === viewer._id,
        content: content ? { _id: content._id, date: content.date } : null,
        hasFile: !!i.fileId,
        likes: await likers(ctx, i.likedBy ?? [], viewer._id),
        comments: await commentsOf(ctx, i._id, viewer._id),
      });
    }
    return out;
  },
});

async function likers(ctx: QueryCtx, ids: Id<"users">[], me: Id<"users">) {
  const people = await Promise.all(ids.map((id) => ctx.db.get(id)));
  return {
    count: ids.length,
    mine: ids.includes(me),
    names: people.filter(Boolean).map((u) => (u!.role === "admin" ? "Estúdio" : displayName(u))),
  };
}

async function commentsOf(ctx: QueryCtx, ideaId: Id<"ideas">, me: Id<"users">) {
  const rows = await ctx.db
    .query("ideaComments")
    .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
    .collect();
  const out = [];
  for (const c of rows) {
    const author = await ctx.db.get(c.authorId);
    out.push({
      _id: c._id,
      body: c.body,
      at: c._creationTime,
      authorName: author?.role === "admin" ? "Estúdio" : displayName(author),
      authorIsStudio: author?.role === "admin",
      isMine: c.authorId === me,
    });
  }
  return out;
}

/** Carrega a ideia e confere se quem pede é do workspace dela (ou admin). */
async function requireIdeaAccess(ctx: QueryCtx, ideaId: Id<"ideas">) {
  const viewer = await requireViewer(ctx);
  const idea = await ctx.db.get(ideaId);
  if (!idea || (viewer.role !== "admin" && viewer.clientId !== idea.clientId)) {
    throw new ConvexError("Ideia não encontrada.");
  }
  return { viewer, idea };
}

/** Curtir ou descurtir um cartão. */
export const toggleLike = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { viewer, idea } = await requireIdeaAccess(ctx, ideaId);
    const current = idea.likedBy ?? [];
    const likedBy = current.includes(viewer._id) ? current.filter((id) => id !== viewer._id) : [...current, viewer._id];
    await ctx.db.patch(ideaId, { likedBy });
  },
});

/** Comentário na conversa do cartão. */
export const addComment = mutation({
  args: { ideaId: v.id("ideas"), body: v.string() },
  handler: async (ctx, { ideaId, body }) => {
    const { viewer, idea } = await requireIdeaAccess(ctx, ideaId);
    const text = body.trim();
    if (!text) throw new ConvexError("Escreva algo antes de enviar.");
    if (text.length > 2000) throw new ConvexError("Comentário muito longo.");
    await ctx.db.insert("ideaComments", { ideaId, clientId: idea.clientId, authorId: viewer._id, body: text });
    // Comentário da cliente traz a ideia de volta para o radar do estúdio.
    if (viewer.role !== "admin" && idea.status === "analise") await ctx.db.patch(ideaId, { status: "nova" });
  },
});

export const removeComment = mutation({
  args: { commentId: v.id("ideaComments") },
  handler: async (ctx, { commentId }) => {
    const viewer = await requireViewer(ctx);
    const c = await ctx.db.get(commentId);
    if (!c) return;
    if (viewer.role !== "admin" && c.authorId !== viewer._id) throw new ConvexError("Só quem escreveu pode apagar.");
    await ctx.db.delete(commentId);
  },
});

/** Últimas referências para o Início (mural em miniatura). */
export const latest = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { client } = await requireClientBySlug(ctx, slug);
    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .order("desc")
      .take(20);
    const out = [];
    for (const i of ideas.filter((x) => x.status !== "arquivada").slice(0, 6)) {
      const file = i.fileId ? await ctx.db.system.get(i.fileId) : null;
      const imageUrl = file?.contentType?.startsWith("image/")
        ? await ctx.storage.getUrl(i.fileId!)
        : i.previewId
          ? await ctx.storage.getUrl(i.previewId)
          : null;
      out.push({ _id: i._id, title: i.title, imageUrl, platform: i.link ? platformOf(i.link) : null, status: i.status });
    }
    return out;
  },
});

/** Qualquer pessoa logada pode subir anexo de ideia; o acesso é checado ao salvar. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireViewer(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

function cleanLink(link?: string) {
  const l = link?.trim();
  if (!l) return undefined;
  if (!/^https?:\/\//.test(l)) throw new ConvexError("O link precisa começar com https://");
  return l;
}

async function queuePreview(ctx: MutationCtx, ideaId: Id<"ideas">, link?: string) {
  if (!link) return;
  await ctx.db.patch(ideaId, { previewStatus: "pendente" });
  await ctx.scheduler.runAfter(0, internal.previews.fetchFor, { ideaId });
}

export const create = mutation({
  args: {
    slug: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    adaptation: v.optional(v.string()),
    link: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { viewer, client } = await requireClientBySlug(ctx, args.slug);
    const link = cleanLink(args.link);
    if (!link && !args.fileId && !args.title?.trim()) {
      throw new ConvexError("Cole um link, envie um print ou escreva a ideia.");
    }
    const title = args.title?.trim() || (link ? `Referência do ${platformLabel(link)}` : "Ideia");
    const id = await ctx.db.insert("ideas", {
      clientId: client._id,
      authorId: viewer._id,
      title,
      description: args.description?.trim() || undefined,
      adaptation: args.adaptation?.trim() || undefined,
      link,
      fileId: args.fileId,
      // O que a própria admin coloca não precisa aparecer como "nova" para ela.
      status: viewer.role === "admin" ? "analise" : "nova",
    });
    await queuePreview(ctx, id, link);
    await logActivity(ctx, { clientId: client._id, userId: viewer._id, kind: "ideia", summary: `Adicionou a referência "${title}"` });
    return id;
  },
});

function platformLabel(link: string) {
  return { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", pinterest: "Pinterest", site: siteName(link) }[platformOf(link)];
}

/** Editar título, link e o comentário de adaptação. Quem criou ou a admin. */
export const update = mutation({
  args: {
    ideaId: v.id("ideas"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    adaptation: v.optional(v.string()),
    link: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
    removeFile: v.optional(v.boolean()),
  },
  handler: async (ctx, { ideaId, title, description, adaptation, link, fileId, removeFile }) => {
    const viewer = await requireViewer(ctx);
    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new ConvexError("Ideia não encontrada.");
    if (viewer.role !== "admin" && (idea.authorId !== viewer._id || idea.clientId !== viewer.clientId)) {
      throw new ConvexError("Só quem enviou ou o estúdio pode editar.");
    }
    const patch: Partial<Doc<"ideas">> = {};
    if (title !== undefined && title.trim()) patch.title = title.trim();
    if (adaptation !== undefined) patch.adaptation = adaptation.trim() || undefined;
    if (description !== undefined) patch.description = description.trim() || undefined;
    if (fileId || removeFile) {
      if (idea.fileId && idea.fileId !== fileId) await ctx.storage.delete(idea.fileId);
      patch.fileId = fileId;
    }
    let newLink: string | undefined;
    let linkChanged = false;
    if (link !== undefined) {
      newLink = cleanLink(link);
      linkChanged = newLink !== idea.link;
      if (linkChanged) {
        patch.link = newLink;
        if (idea.previewId) await ctx.storage.delete(idea.previewId);
        patch.previewId = undefined;
        patch.previewTitle = undefined;
        patch.previewStatus = undefined;
      }
    }
    await ctx.db.patch(ideaId, patch);
    if (linkChanged) await queuePreview(ctx, ideaId, newLink);
  },
});

/** Tentar de novo a prévia do link (quando o site não respondeu). */
export const retryPreview = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    await requireViewer(ctx);
    const idea = await ctx.db.get(ideaId);
    if (idea?.link) await queuePreview(ctx, ideaId, idea.link);
  },
});

export const setStatus = mutation({
  args: { ideaId: v.id("ideas"), status: v.union(v.literal("nova"), v.literal("analise"), v.literal("arquivada")) },
  handler: async (ctx, { ideaId, status }) => {
    await requireAdmin(ctx);
    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new ConvexError("Ideia não encontrada.");
    if (idea.status === "convertida") throw new ConvexError("Esta ideia já virou conteúdo.");
    await ctx.db.patch(ideaId, { status });
  },
});

/** Quem enviou pode apagar enquanto o estúdio não começou a trabalhar nela. */
export const remove = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const viewer = await requireViewer(ctx);
    const idea = await ctx.db.get(ideaId);
    if (!idea) return;
    const mine = idea.authorId === viewer._id && idea.status === "nova";
    if (viewer.role !== "admin" && !mine) throw new ConvexError("Esta ideia já está com o estúdio.");
    if (idea.fileId) await ctx.storage.delete(idea.fileId);
    if (idea.previewId) await ctx.storage.delete(idea.previewId);
    for (const c of await ctx.db.query("ideaComments").withIndex("by_idea", (q) => q.eq("ideaId", ideaId)).collect()) {
      await ctx.db.delete(c._id);
    }
    await ctx.db.delete(ideaId);
  },
});
