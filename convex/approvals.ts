import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireClientBySlug } from "./lib/access";
import { alive, toCard } from "./lib/content";

/**
 * Página "Para aprovar": tudo o que espera a decisão da cliente, de qualquer mês.
 * Para a admin, vem também o WhatsApp e os links pessoais para mandar a página.
 */
export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { viewer, client } = await requireClientBySlug(ctx, slug);
    const waiting = (
      await ctx.db
        .query("contents")
        .withIndex("by_client_status", (q) => q.eq("clientId", client._id).eq("status", "aguardando"))
        .collect()
    ).filter(alive);
    waiting.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
    const items = [];
    for (const c of waiting) {
      const captions = await ctx.db
        .query("captions")
        .withIndex("by_content", (q) => q.eq("contentId", c._id))
        .collect();
      const media = await ctx.db
        .query("media")
        .withIndex("by_content_version", (q) => q.eq("contentId", c._id).eq("version", c.version))
        .collect();
      const first = captions.sort((a, b) => a.order - b.order)[0];
      items.push({
        ...(await toCard(ctx, c)),
        cards: media.length,
        captionOptions: captions.length,
        caption: first?.text.slice(0, 180) ?? null,
      });
    }
    const admin = viewer.role === "admin";
    const people = admin
      ? (await ctx.db.query("invites").collect())
          .filter((i) => i.clientId === client._id && i.role === "cliente" && i.token)
          .map((i) => ({ name: i.name ?? i.email.split("@")[0], token: i.token! }))
      : [];
    return {
      client: { name: client.name, accentColor: client.accentColor },
      items,
      isAdmin: admin,
      whatsapp: admin ? (client.whatsapp ?? null) : null,
      people,
    };
  },
});
