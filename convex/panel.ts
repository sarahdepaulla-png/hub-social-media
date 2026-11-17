import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin, requireClientBySlug } from "./lib/access";
import { toCard } from "./lib/content";
import { displayName } from "./lib/log";
import { DEFAULT_FOLDERS } from "./profile";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ONLINE_MS = 3 * 60 * 1000;

function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Painel da cliente no estúdio: o mês dela de uma olhada, o que precisa de você,
 * as pastas de arquivos e o banco de conteúdo. Só a admin vê.
 */
export const get = query({
  args: { slug: v.string(), today: v.string() },
  handler: async (ctx, { slug, today }) => {
    await requireAdmin(ctx);
    if (!DATE.test(today)) throw new ConvexError("Data inválida.");
    const { client } = await requireClientBySlug(ctx, slug);
    const month = today.slice(0, 7);
    const monthStart = `${month}-01`;
    const now = Date.now();

    const all = (
      await ctx.db
        .query("contents")
        .withIndex("by_client_date", (q) => q.eq("clientId", client._id))
        .collect()
    ).filter((c) => !c.deletedAt);

    const inMonth = all.filter((c) => c.date.startsWith(month));
    const counts = { total: 0, ideia: 0, producao: 0, aguardando: 0, ajuste: 0, aprovado: 0, agendado: 0, publicado: 0 };
    for (const c of inMonth) {
      counts.total++;
      counts[c.status]++;
    }
    const late = all.filter((c) => c.date >= monthStart && c.date < today && c.status !== "publicado" && c.status !== "ideia");
    const upcoming = all
      .filter((c) => c.date >= today && c.status !== "publicado" && c.status !== "ideia")
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))
      .slice(0, 6);
    const ajustes = all.filter((c) => c.date >= monthStart && c.status === "ajuste");
    const published = all
      .filter((c) => c.status === "publicado")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 24);

    // Planos deste mês e do próximo.
    const plans = [];
    for (const m of [month, nextMonth(month)]) {
      const p = await ctx.db
        .query("monthPlans")
        .withIndex("by_client_month", (q) => q.eq("clientId", client._id).eq("month", m))
        .first();
      plans.push({ month: m, status: p?.status ?? null, theme: p?.theme ?? null, posts: p?.pieces.length ?? 0, decidedBy: p?.decision?.name ?? null });
    }

    // Banco de conteúdo: o que a cliente mandou e ainda não virou post.
    const briefings = (await ctx.db.query("briefings").withIndex("by_client", (q) => q.eq("clientId", client._id)).collect()).filter((b) => b.status === "novo");
    const ideas = (await ctx.db.query("ideas").withIndex("by_client", (q) => q.eq("clientId", client._id)).collect()).filter((i) => i.status === "nova" || i.status === "analise");
    const pautas = (await ctx.db.query("pautas").withIndex("by_client", (q) => q.eq("clientId", client._id)).collect()).filter((p) => p.status !== "calendario");

    const names = new Map<string, string>();
    const who = async (id: Doc<"users">["_id"]) => {
      if (!names.has(id)) names.set(id, displayName(await ctx.db.get(id)));
      return names.get(id)!;
    };

    const bank = [
      ...(await Promise.all(
        pautas.map(async (p) => ({
          _id: p._id as string,
          type: "pauta" as const,
          title: p.title,
          text: p.notes ?? null,
          status: p.status,
          month: p.month ?? null,
          link: p.link ?? null,
          files: p.files?.length ?? 0,
          who: await who(p.authorId),
          at: p._creationTime,
        })),
      )),
      ...(await Promise.all(
        ideas.map(async (i) => ({
          _id: i._id as string,
          type: "ideia" as const,
          title: i.title,
          text: i.description ?? null,
          status: i.status,
          month: null,
          link: i.link ?? null,
          files: i.fileId ? 1 : 0,
          who: await who(i.authorId),
          at: i._creationTime,
        })),
      )),
      ...(await Promise.all(
        briefings.map(async (b) => ({
          _id: b._id as string,
          type: "briefing" as const,
          title: b.title,
          text: b.body.slice(0, 220),
          status: b.status,
          month: b.desiredDate?.slice(0, 7) ?? null,
          link: null,
          files: b.links.length,
          who: await who(b.authorId),
          at: b._creationTime,
        })),
      )),
    ].sort((a, b) => b.at - a.at);

    // Arquivos que a cliente mandou junto com pautas e ideias (pasta automática).
    const sent = [];
    for (const p of pautas.concat(
      (await ctx.db.query("pautas").withIndex("by_client", (q) => q.eq("clientId", client._id)).collect()).filter((p) => p.status === "calendario"),
    )) {
      for (const f of p.files ?? []) {
        sent.push({ name: f.name, type: f.type, url: await ctx.storage.getUrl(f.id), from: `Pauta: ${p.title}`, who: await who(p.authorId), at: p._creationTime });
      }
    }
    for (const i of await ctx.db.query("ideas").withIndex("by_client", (q) => q.eq("clientId", client._id)).collect()) {
      if (!i.fileId) continue;
      sent.push({ name: i.title, type: "image/*", url: await ctx.storage.getUrl(i.fileId), from: `Ideia: ${i.title}`, who: await who(i.authorId), at: i._creationTime });
    }
    sent.sort((a, b) => b.at - a.at);

    // Pastas: resumo (o conteúdo de cada uma vem de profile.get).
    const items = await ctx.db
      .query("profileItems")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .collect();
    const folderNames = [...DEFAULT_FOLDERS, ...[...new Set([...items.map((i) => i.folder), ...(client.folders ?? [])])].filter((f) => !DEFAULT_FOLDERS.includes(f)).sort((a, b) => a.localeCompare(b, "pt-BR"))];
    const folders = await Promise.all(
      folderNames.map(async (name) => {
        const inside = items.filter((i) => i.folder === name).sort((a, b) => b.updatedAt - a.updatedAt);
        const img = inside.find((i) => i.file?.type.startsWith("image/"));
        return {
          name,
          fixed: DEFAULT_FOLDERS.includes(name),
          count: inside.length,
          updatedAt: inside[0]?.updatedAt ?? null,
          previewUrl: img?.file ? await ctx.storage.getUrl(img.file.id) : null,
        };
      }),
    );

    const people = (await ctx.db.query("users").collect())
      .filter((u) => u.role === "cliente" && u.clientId === client._id)
      .map((u) => ({ name: displayName(u), online: !!u.lastSeenAt && now - u.lastSeenAt < ONLINE_MS, lastSeenAt: u.lastSeenAt ?? null }))
      .sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));

    return {
      client: {
        name: client.name,
        slug: client.slug,
        accentColor: client.accentColor,
        photoUrl: client.photoId ? await ctx.storage.getUrl(client.photoId) : null,
        instagram: client.instagram ?? null,
        description: client.description ?? null,
        canEdit: client.clientCanEdit === true,
      },
      month,
      people,
      counts,
      late: await Promise.all(late.map((c) => toCard(ctx, c))),
      ajustes: await Promise.all(ajustes.map((c) => toCard(ctx, c))),
      upcoming: await Promise.all(upcoming.map((c) => toCard(ctx, c))),
      published: await Promise.all(published.map((c) => toCard(ctx, c))),
      plans,
      bank,
      sent,
      folders,
    };
  },
});
