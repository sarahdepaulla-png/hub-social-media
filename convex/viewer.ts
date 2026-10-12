import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getRealUser, getViewer } from "./lib/access";

/** Quem está logado e para onde deve ir. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    if (!viewer) return null;
    const client = viewer.clientId ? await ctx.db.get(viewer.clientId) : null;
    return {
      _id: viewer._id,
      name: viewer.name ?? null,
      email: viewer.email ?? null,
      role: viewer.role ?? null,
      client: client ? { slug: client.slug, name: client.name } : null,
      viewingAs: viewer.viewingAs === true,
    };
  },
});

/** Liga ou desliga o modo "ver como cliente" (só a admin). slug vazio = volta para o estúdio. */
export const setViewAs = mutation({
  args: { slug: v.optional(v.string()) },
  handler: async (ctx, { slug }) => {
    const user = await getRealUser(ctx);
    if (!user || user.role !== "admin") throw new ConvexError("Só a administradora pode fazer isso.");
    if (!slug) {
      await ctx.db.patch(user._id, { viewAsClientId: undefined });
      return null;
    }
    const client = await ctx.db
      .query("clients")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!client) throw new ConvexError("Cliente não encontrado.");
    await ctx.db.patch(user._id, { viewAsClientId: client._id });
    return client.slug;
  },
});
