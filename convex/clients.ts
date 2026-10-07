import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireClientBySlug } from "./lib/access";
import { contentsInMonth, countByStatus } from "./lib/content";
import type { Id } from "./_generated/dataModel";

async function brand(ctx: Parameters<typeof requireAdmin>[0], c: { logoId?: Id<"_storage">; photoId?: Id<"_storage"> }) {
  return {
    logoUrl: c.logoId ? await ctx.storage.getUrl(c.logoId) : null,
    photoUrl: c.photoId ? await ctx.storage.getUrl(c.photoId) : null,
  };
}

/** Cabeçalho do workspace: identidade do cliente. */
export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    try {
      return await workspaceHeader(ctx, slug);
    } catch (err) {
      // Mostra o motivo real na tela de erro (erro comum vira "Server Error" sem detalhe).
      if (err instanceof ConvexError) throw err;
      console.error("bySlug", slug, err);
      throw new ConvexError(`Não deu para abrir o workspace: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300));
    }
  },
});

async function workspaceHeader(ctx: Parameters<typeof requireAdmin>[0], slug: string) {
    const { viewer, client } = await requireClientBySlug(ctx, slug);
    return {
      _id: client._id,
      slug: client.slug,
      name: client.name,
      description: client.description ?? null,
      niches: client.niches,
      accentColor: client.accentColor,
      secondaryColor: client.secondaryColor ?? null,
      ...(await brand(ctx, client)),
      viewerRole: viewer.role!,
      // Ideias que ainda ninguém do estúdio olhou (só interessa à admin).
      newIdeas:
        viewer.role === "admin"
          ? (await ctx.db.query("ideas").withIndex("by_client", (q) => q.eq("clientId", client._id)).collect()).filter(
              (i) => i.status === "nova",
            ).length +
            (await ctx.db.query("pautas").withIndex("by_client", (q) => q.eq("clientId", client._id)).collect()).filter(
              (p) => p.status === "nova",
            ).length
          : 0,
    };
}

/** Visão do estúdio: todos os clientes com o mês resumido. */
export const listForStudio = query({
  args: { month: v.string(), today: v.string() },
  handler: async (ctx, { month, today }) => {
    await requireAdmin(ctx);
    const clients = await ctx.db.query("clients").collect();
    const rows = [];
    for (const client of clients.filter((c) => c.active)) {
      const list = (await contentsInMonth(ctx, client._id, month)).sort((a, b) => a.date.localeCompare(b.date));
      const next = list.find((c) => c.date >= today && c.status !== "ideia");
      rows.push({
        _id: client._id,
        slug: client.slug,
        name: client.name,
        accentColor: client.accentColor,
        photoUrl: client.photoId ? await ctx.storage.getUrl(client.photoId) : null,
        counts: countByStatus(list),
        strip: await Promise.all(list.map(async (c) => ({ _id: c._id, status: c.status, date: c.date, title: c.title, coverUrl: c.coverId ? await ctx.storage.getUrl(c.coverId) : null }))),
        nextDate: next?.date ?? null,
        newIdeas: (await ctx.db.query("ideas").withIndex("by_client", (q) => q.eq("clientId", client._id)).collect()).filter(
          (i) => i.status === "nova",
        ).length,
        newPautas: (await ctx.db.query("pautas").withIndex("by_client", (q) => q.eq("clientId", client._id)).collect()).filter(
          (p) => p.status === "nova",
        ).length,
        newBriefings: (await ctx.db.query("briefings").withIndex("by_client", (q) => q.eq("clientId", client._id)).collect()).filter(
          (b) => b.status === "novo",
        ).length,
      });
    }
    return rows.sort((a, b) => b.counts.ajuste - a.counts.ajuste || b.counts.aguardando - a.counts.aguardando);
  },
});

/* ---------- Cadastro (admin) ---------- */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Todos os clientes com quem tem acesso a cada um. */
export const listAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const clients = await ctx.db.query("clients").collect();
    const invites = await ctx.db.query("invites").collect();
    const out = [];
    for (const c of clients.sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({
        _id: c._id,
        slug: c.slug,
        name: c.name,
        description: c.description ?? null,
        niches: c.niches,
        accentColor: c.accentColor,
        secondaryColor: c.secondaryColor ?? null,
        active: c.active,
        ...(await brand(ctx, c)),
        people: invites
          .filter((i) => i.clientId === c._id)
          .map((i) => ({
            _id: i._id,
            email: i.email,
            name: i.name ?? null,
            accepted: !!i.acceptedAt,
            token: i.token ?? null,
            emailedAt: i.emailedAt ?? null,
            emailError: i.emailError ?? null,
            emailPending: !!i.emailPending,
          })),
      });
    }
    return out;
  },
});

const clientFields = {
  name: v.string(),
  description: v.optional(v.string()),
  niches: v.array(v.string()),
  accentColor: v.string(),
  secondaryColor: v.optional(v.string()),
};

function validate(args: { name: string; accentColor: string; secondaryColor?: string }) {
  if (!args.name.trim()) throw new ConvexError("Dê um nome para o cliente.");
  if (!HEX.test(args.accentColor)) throw new ConvexError("Cor de destaque inválida. Use o formato #RRGGBB.");
  if (args.secondaryColor && !HEX.test(args.secondaryColor)) throw new ConvexError("Cor secundária inválida.");
}

export const create = mutation({
  args: { slug: v.string(), ...clientFields },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    validate(args);
    const slug = args.slug.trim().toLowerCase();
    if (!SLUG.test(slug)) throw new ConvexError("O endereço só aceita letras minúsculas, números e hífen. Ex.: clinica-vivi");
    const taken = await ctx.db
      .query("clients")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (taken) throw new ConvexError("Já existe um cliente com esse endereço.");
    return await ctx.db.insert("clients", {
      slug,
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      niches: args.niches,
      accentColor: args.accentColor,
      secondaryColor: args.secondaryColor || undefined,
      active: true,
    });
  },
});

export const update = mutation({
  args: { clientId: v.id("clients"), active: v.optional(v.boolean()), ...clientFields },
  handler: async (ctx, { clientId, ...args }) => {
    await requireAdmin(ctx);
    validate(args);
    await ctx.db.patch(clientId, {
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      niches: args.niches,
      accentColor: args.accentColor,
      secondaryColor: args.secondaryColor || undefined,
      ...(args.active === undefined ? {} : { active: args.active }),
    });
  },
});

/** Troca logo ou foto do cliente. */
export const setImage = mutation({
  args: { clientId: v.id("clients"), kind: v.union(v.literal("logo"), v.literal("foto")), storageId: v.id("_storage") },
  handler: async (ctx, { clientId, kind, storageId }) => {
    await requireAdmin(ctx);
    const client = await ctx.db.get(clientId);
    if (!client) throw new ConvexError("Cliente não encontrado.");
    const old = kind === "logo" ? client.logoId : client.photoId;
    await ctx.db.patch(clientId, kind === "logo" ? { logoId: storageId } : { photoId: storageId });
    if (old) await ctx.storage.delete(old);
  },
});
