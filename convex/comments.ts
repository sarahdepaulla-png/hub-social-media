import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireContentAccess } from "./lib/access";
import { logActivity } from "./lib/log";

/** Comentário na thread da peça. Admin e cliente respondem. */
export const add = mutation({
  args: {
    contentId: v.id("contents"),
    body: v.string(),
    parentId: v.optional(v.id("comments")),
    mediaOrder: v.optional(v.number()),
  },
  handler: async (ctx, { contentId, body, parentId, mediaOrder }) => {
    const { viewer, content } = await requireContentAccess(ctx, contentId);
    const text = body.trim();
    if (!text) throw new ConvexError("Escreva algo antes de enviar.");
    if (text.length > 4000) throw new ConvexError("Comentário muito longo. Divida em partes.");
    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (!parent || parent.contentId !== contentId) throw new ConvexError("Comentário original não encontrado.");
    }
    const id = await ctx.db.insert("comments", {
      contentId,
      clientId: content.clientId,
      authorId: viewer._id,
      body: text,
      parentId,
      mediaOrder,
    });
    await logActivity(ctx, {
      clientId: content.clientId,
      contentId,
      userId: viewer._id,
      kind: "comentario",
      summary: `Comentou: "${text.length > 80 ? text.slice(0, 80) + "…" : text}"`,
    });
    return id;
  },
});
