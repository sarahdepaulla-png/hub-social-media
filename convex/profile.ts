import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin, requireClientBySlug } from "./lib/access";

/**
 * Perfil da cliente: pastas com o que o estúdio precisa ter à mão
 * (Drive, acessos e senhas, marca, anotações). Só a admin vê e edita.
 */

const DEFAULT_FOLDERS = ["Drive e arquivos", "Acessos e senhas", "Marca", "Anotações"];

const kind = v.union(v.literal("link"), v.literal("acesso"), v.literal("arquivo"), v.literal("nota"));
const fileV = v.object({ id: v.id("_storage"), name: v.string(), type: v.string() });

const fields = {
  folder: v.string(),
  kind,
  title: v.string(),
  url: v.optional(v.string()),
  login: v.optional(v.string()),
  secret: v.optional(v.string()),
  note: v.optional(v.string()),
  file: v.optional(fileV),
};

type Fields = {
  folder: string;
  kind: "link" | "acesso" | "arquivo" | "nota";
  title: string;
  url?: string;
  login?: string;
  secret?: string;
  note?: string;
  file?: { id: Id<"_storage">; name: string; type: string };
};

function clean(f: Fields) {
  const folder = f.folder.trim().slice(0, 60);
  if (!folder) throw new ConvexError("Escolha a pasta.");
  const t = (s?: string, max = 2000) => s?.trim().slice(0, max) || undefined;
  let url = t(f.url, 1000);
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (url && !/^https?:\/\/\S+$/i.test(url)) throw new ConvexError("Esse link não parece válido.");
  const title = t(f.title, 120) ?? (f.kind === "arquivo" ? f.file?.name : undefined) ?? (url ? url.replace(/^https?:\/\//, "").slice(0, 60) : undefined);
  if (!title) throw new ConvexError("Dê um nome ao item.");
  if (f.kind === "link" && !url) throw new ConvexError("Cole o link.");
  if (f.kind === "acesso" && !t(f.login) && !t(f.secret)) throw new ConvexError("Preencha o login ou a senha.");
  if (f.kind === "arquivo" && !f.file) throw new ConvexError("Escolha o arquivo.");
  if (f.kind === "nota" && !t(f.note)) throw new ConvexError("Escreva a anotação.");
  return {
    folder,
    kind: f.kind,
    title,
    url,
    login: t(f.login, 200),
    secret: t(f.secret, 500),
    note: t(f.note, 6000),
    file: f.file,
    updatedAt: Date.now(),
  };
}

async function loadItem(ctx: MutationCtx, itemId: Id<"profileItems">) {
  await requireAdmin(ctx);
  const item = await ctx.db.get(itemId);
  if (!item) throw new ConvexError("Item não encontrado.");
  return item;
}

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, slug);
    const rows = await ctx.db
      .query("profileItems")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .collect();
    const items = await Promise.all(
      rows.map(async (r) => ({
        _id: r._id,
        folder: r.folder,
        kind: r.kind,
        title: r.title,
        url: r.url ?? null,
        login: r.login ?? null,
        secret: r.secret ?? null,
        note: r.note ?? null,
        file: r.file ? { ...r.file, url: await ctx.storage.getUrl(r.file.id) } : null,
        updatedAt: r.updatedAt,
      })),
    );
    const custom = [...new Set(rows.map((r) => r.folder))]
      .filter((f) => !DEFAULT_FOLDERS.includes(f))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    return {
      client: { name: client.name, slug: client.slug, accentColor: client.accentColor },
      folders: [...DEFAULT_FOLDERS, ...custom],
      items: items.sort((a, b) => a.title.localeCompare(b.title, "pt-BR")),
    };
  },
});

export const add = mutation({
  args: { slug: v.string(), ...fields },
  handler: async (ctx, { slug, ...f }) => {
    await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, slug);
    return await ctx.db.insert("profileItems", { clientId: client._id, ...clean(f) });
  },
});

export const update = mutation({
  args: { itemId: v.id("profileItems"), ...fields },
  handler: async (ctx, { itemId, ...f }) => {
    const item = await loadItem(ctx, itemId);
    const data = clean(f);
    if (item.file && item.file.id !== data.file?.id) await ctx.storage.delete(item.file.id);
    await ctx.db.patch(itemId, data);
  },
});

export const remove = mutation({
  args: { itemId: v.id("profileItems") },
  handler: async (ctx, { itemId }) => {
    const item = await loadItem(ctx, itemId);
    if (item.file) await ctx.storage.delete(item.file.id);
    await ctx.db.delete(itemId);
  },
});

/** Renomeia uma pasta: todos os itens dela mudam juntos. */
export const renameFolder = mutation({
  args: { slug: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, { slug, from, to }) => {
    await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, slug);
    const name = to.trim().slice(0, 60);
    if (!name) throw new ConvexError("Dê um nome à pasta.");
    const rows = await ctx.db
      .query("profileItems")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .collect();
    for (const r of rows.filter((r) => r.folder === from)) await ctx.db.patch(r._id, { folder: name });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
