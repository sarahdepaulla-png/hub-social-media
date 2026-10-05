import { query } from "./_generated/server";
import { getViewer } from "./lib/access";

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
    };
  },
});
