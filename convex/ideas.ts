import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireClientBySlug, requireViewer } from "./lib/access";
import { displayName, logActivity } from "./lib/log";

/** Caixa de Ideias do workspace, mais recentes primeiro. */
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
      out.push({
        _id: i._id,
        title: i.title,
        description: i.description ?? null,
        link: i.link ?? null,
        fileUrl: i.fileId ? await ctx.storage.getUrl(i.fileId) : null,
        status: i.status,
        at: i._creationTime,
        authorName: displayName(author),
        isMine: i.authorId === viewer._id,
        content: content ? { _id: content._id, date: content.date } : null,
      });
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

export const create = mutation({
  args: {
    slug: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    link: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { viewer, client } = await requireClientBySlug(ctx, args.slug);
    const title = args.title.trim();
    if (!title) throw new ConvexError("Dê um título para a ideia.");
    const link = args.link?.trim();
    if (link && !/^https?:\/\//.test(link)) throw new ConvexError("O link precisa começar com https://");
    const id = await ctx.db.insert("ideas", {
      clientId: client._id,
      authorId: viewer._id,
      title,
      description: args.description?.trim() || undefined,
      link: link || undefined,
      fileId: args.fileId,
      status: "nova",
    });
    await logActivity(ctx, { clientId: client._id, userId: viewer._id, kind: "ideia", summary: `Enviou a ideia "${title}"` });
    return id;
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
    await ctx.db.delete(ideaId);
  },
});
