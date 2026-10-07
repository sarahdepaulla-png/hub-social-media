import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin, requireClientBySlug } from "./lib/access";
import { newToken } from "./access";
import { logActivity } from "./lib/log";

/**
 * Métricas automáticas do Instagram pela API da Meta com login do Facebook.
 * O app da Sarah fica em modo de desenvolvimento (sem análise). Quem faz o login
 * (a Sarah, quando administra a Página do cliente, ou a própria cliente) libera as
 * contas do Instagram ligadas às Páginas; o Hub busca tudo sozinho de hora em hora.
 */

const GRAPH = "https://graph.facebook.com/v23.0";
const SCOPES = "instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement,business_management";
const DAY = 86_400_000;

function config() {
  const appId = process.env.IG_APP_ID;
  const secret = process.env.IG_APP_SECRET;
  const site = process.env.SITE_URL?.replace(/\/$/, "");
  return { appId, secret, site, redirect: site ? `${site}/instagram/conectar` : undefined };
}

/** Data em São Paulo (sem horário de verão desde 2019). */
function spDate(ms: number) {
  return new Date(ms - 3 * 3_600_000).toISOString().slice(0, 10);
}

function parseTime(ts: string) {
  return Date.parse(ts.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
}

async function ig<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${GRAPH}${path}`);
  for (const [k, val] of Object.entries(params)) url.searchParams.set(k, val);
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!res.ok || body.error) throw new Error(body.error?.message ?? `A Meta respondeu ${res.status}`);
  return body;
}

/* ---------- Conexão ---------- */

/**
 * Gera o link de conexão. Com clientSlug: link para mandar à cliente.
 * Sem clientSlug: a admin conecta com o próprio Facebook e escolhe qual conta é de qual cliente.
 */
export const createConnectLink = mutation({
  args: { clientSlug: v.optional(v.string()) },
  handler: async (ctx, { clientSlug }) => {
    await requireAdmin(ctx);
    const clientId = clientSlug ? (await requireClientBySlug(ctx, clientSlug)).client._id : undefined;
    const state = newToken();
    await ctx.db.insert("igConnectStates", { state, clientId, expiresAt: Date.now() + 7 * DAY });
    const { site } = config();
    return `${site ?? ""}/instagram/conectar?s=${state}`;
  },
});

async function stateRow(ctx: QueryCtx, state: string) {
  const row = await ctx.db
    .query("igConnectStates")
    .withIndex("by_state", (q) => q.eq("state", state))
    .first();
  return row && row.expiresAt > Date.now() ? row : null;
}

/** Página de conexão: confere o link, devolve o login do Facebook ou as contas achadas para escolher. */
export const connectInfo = query({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const row = await stateRow(ctx, state);
    if (!row) return { ok: false as const, reason: "Este link venceu ou já foi usado. Peça um novo ao estúdio." };
    const client = row.clientId ? await ctx.db.get(row.clientId) : null;
    const { appId, redirect } = config();
    if (!appId || !redirect) return { ok: false as const, reason: "A conexão com o Instagram ainda não foi configurada pelo estúdio." };
    const url = new URL("https://www.facebook.com/v23.0/dialog/oauth");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("response_type", "code");
    // Com uma Configuração do Login do Facebook para Empresas, a Meta usa as permissões dela.
    const configId = process.env.IG_CONFIG_ID?.trim();
    if (configId) url.searchParams.set("config_id", configId);
    else url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    const clients = row.clientId
      ? []
      : (await ctx.db.query("clients").collect()).filter((c) => c.active).map((c) => ({ slug: c.slug, name: c.name }));
    return {
      ok: true as const,
      clientName: client?.name ?? null,
      authUrl: url.toString(),
      clients,
      candidates: (row.candidates ?? []).map(({ token, ...c }) => {
        void token;
        return c;
      }),
    };
  },
});

export const stateInfo = internalQuery({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const row = await stateRow(ctx, state);
    return row ? { clientId: row.clientId ?? null } : null;
  },
});

type Candidate = { igUserId: string; username: string; pageName: string; pictureUrl?: string; followers?: number; token: string };

/** Volta do Facebook com o código: acha as contas do Instagram ligadas às Páginas. */
export const finishConnect = action({
  args: { state: v.string(), code: v.string() },
  handler: async (ctx, { state, code }): Promise<{ connected: string | null; choose: number }> => {
    const info = await ctx.runQuery(internal.instagram.stateInfo, { state });
    if (!info) throw new ConvexError("Este link venceu ou já foi usado. Peça um novo ao estúdio.");
    const { appId, secret, redirect } = config();
    if (!appId || !secret || !redirect) throw new ConvexError("A conexão com o Instagram ainda não foi configurada.");

    let userToken: string;
    try {
      const short = await ig<{ access_token: string }>(`${GRAPH}/oauth/access_token`, { client_id: appId, client_secret: secret, redirect_uri: redirect, code });
      const long = await ig<{ access_token: string }>(`${GRAPH}/oauth/access_token`, {
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: secret,
        fb_exchange_token: short.access_token,
      });
      userToken = long.access_token;
    } catch (err) {
      throw new ConvexError(`O Facebook não aceitou a conexão: ${(err as Error).message}`);
    }

    type Page = {
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username?: string; profile_picture_url?: string; followers_count?: number };
    };
    let pages: Page[];
    try {
      pages = (
        await ig<{ data: Page[] }>("/me/accounts", {
          fields: "name,access_token,instagram_business_account{id,username,profile_picture_url,followers_count}",
          limit: "100",
          access_token: userToken,
        })
      ).data;
    } catch (err) {
      throw new ConvexError(`Conectou, mas não deu para ler as Páginas: ${(err as Error).message}`);
    }
    const candidates: Candidate[] = pages
      .filter((p) => p.instagram_business_account)
      .map((p) => ({
        igUserId: p.instagram_business_account!.id,
        username: p.instagram_business_account!.username ?? p.name,
        pageName: p.name,
        pictureUrl: p.instagram_business_account!.profile_picture_url,
        followers: p.instagram_business_account!.followers_count,
        // Token da Página gerado de um token longo: não vence enquanto o acesso existir.
        token: p.access_token,
      }));
    if (candidates.length === 0) {
      throw new ConvexError("Nenhum Instagram profissional ligado às Páginas desse Facebook. Confira se o Instagram está conectado a uma Página e se você marcou as Páginas no login.");
    }
    if (info.clientId && candidates.length === 1) {
      await ctx.runMutation(internal.instagram.saveAccount, { clientId: info.clientId, state, ...candidates[0] });
      await ctx.scheduler.runAfter(0, internal.instagram.syncClient, { clientId: info.clientId });
      return { connected: candidates[0].username, choose: 0 };
    }
    await ctx.runMutation(internal.instagram.saveCandidates, { state, candidates });
    return { connected: null, choose: candidates.length };
  },
});

export const saveCandidates = internalMutation({
  args: {
    state: v.string(),
    candidates: v.array(
      v.object({ igUserId: v.string(), username: v.string(), pageName: v.string(), pictureUrl: v.optional(v.string()), followers: v.optional(v.number()), token: v.string() }),
    ),
  },
  handler: async (ctx, { state, candidates }) => {
    const row = await stateRow(ctx, state);
    if (row) await ctx.db.patch(row._id, { candidates });
  },
});

/**
 * Escolha de qual conta é de qual cliente.
 * Link da cliente: escolhe a conta dela. Link da admin (logada): liga várias de uma vez.
 */
export const assignAccounts = mutation({
  args: { state: v.string(), pairs: v.array(v.object({ igUserId: v.string(), clientSlug: v.optional(v.string()) })) },
  handler: async (ctx, { state, pairs }) => {
    const row = await stateRow(ctx, state);
    if (!row?.candidates) throw new ConvexError("Este link venceu. Comece a conexão de novo.");
    const chosen = pairs.filter((p) => row.clientId || p.clientSlug);
    if (row.clientId && chosen.length !== 1) throw new ConvexError("Escolha uma conta.");
    if (!row.clientId) await requireAdmin(ctx);
    const done: string[] = [];
    for (const pair of chosen) {
      const cand = row.candidates.find((c) => c.igUserId === pair.igUserId);
      if (!cand) continue;
      const clientId = row.clientId ?? (await requireClientBySlug(ctx, pair.clientSlug!)).client._id;
      await upsertAccount(ctx, clientId, cand);
      await ctx.scheduler.runAfter(0, internal.instagram.syncClient, { clientId });
      done.push(cand.username);
    }
    await ctx.db.delete(row._id);
    return done;
  },
});

async function upsertAccount(ctx: MutationCtx, clientId: Id<"clients">, a: Candidate) {
  const existing = await ctx.db
    .query("igAccounts")
    .withIndex("by_client", (q) => q.eq("clientId", clientId))
    .first();
  const data = {
    clientId,
    igUserId: a.igUserId,
    username: a.username,
    pageName: a.pageName,
    pictureUrl: a.pictureUrl,
    followers: a.followers,
    token: a.token,
    tokenExpiresAt: Date.now() + 365 * DAY,
    connectedAt: Date.now(),
    lastError: undefined,
  };
  if (existing) await ctx.db.patch(existing._id, data);
  else await ctx.db.insert("igAccounts", data);
}

export const saveAccount = internalMutation({
  args: {
    clientId: v.id("clients"),
    state: v.string(),
    igUserId: v.string(),
    username: v.string(),
    pageName: v.string(),
    pictureUrl: v.optional(v.string()),
    followers: v.optional(v.number()),
    token: v.string(),
  },
  handler: async (ctx, { state, clientId, ...a }) => {
    await upsertAccount(ctx, clientId, a);
    const row = await stateRow(ctx, state);
    if (row) await ctx.db.delete(row._id);
  },
});

export const disconnect = mutation({
  args: { clientSlug: v.string() },
  handler: async (ctx, { clientSlug }) => {
    await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, clientSlug);
    const acc = await ctx.db
      .query("igAccounts")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .first();
    if (acc) await ctx.db.delete(acc._id);
  },
});

/* ---------- Busca automática ---------- */

type Media = {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  permalink?: string;
  timestamp: string;
  thumbnail_url?: string;
  media_url?: string;
  like_count?: number;
  comments_count?: number;
};

const METRICS = ["reach", "views", "saved", "shares", "likes", "comments", "total_interactions"];
const STORY_METRICS = ["reach", "views", "shares", "total_interactions"];

/** Pede as métricas de uma vez; se alguma não existir para o tipo, tenta uma por uma. */
async function insights(mediaId: string, token: string, story: boolean) {
  const wanted = story ? STORY_METRICS : METRICS;
  const read = (body: { data?: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }) => {
    const out: Record<string, number> = {};
    for (const m of body.data ?? []) out[m.name] = m.values?.[0]?.value ?? m.total_value?.value ?? 0;
    return out;
  };
  try {
    return read(await ig(`/${mediaId}/insights`, { metric: wanted.join(","), access_token: token }));
  } catch {
    const out: Record<string, number> = {};
    for (const m of wanted) {
      try {
        Object.assign(out, read(await ig(`/${mediaId}/insights`, { metric: m, access_token: token })));
      } catch {
        /* métrica indisponível para este tipo de post */
      }
    }
    return out;
  }
}

export const accountsToSync = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("igAccounts").collect()).map((a) => a.clientId),
});

export const accountFor = internalQuery({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const acc = await ctx.db
      .query("igAccounts")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .first();
    if (!acc) return null;
    const known = await ctx.db
      .query("igPosts")
      .withIndex("by_client_time", (q) => q.eq("clientId", clientId).gte("timestamp", Date.now() - 60 * DAY))
      .collect();
    return { acc, known: known.map((p) => ({ mediaId: p.mediaId, timestamp: p.timestamp, insightsAt: p.insightsAt ?? 0 })) };
  },
});

/** De hora em hora: renova o acesso, lê seguidores, posts, stories e métricas. */
export const syncAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const ids = await ctx.runQuery(internal.instagram.accountsToSync, {});
    for (const clientId of ids) await ctx.runAction(internal.instagram.syncClient, { clientId });
  },
});

export const syncClient = internalAction({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const data = await ctx.runQuery(internal.instagram.accountFor, { clientId });
    if (!data) return;
    const { acc, known } = data;
    const token = acc.token;
    try {
      const me = await ig<{ username: string; followers_count?: number; profile_picture_url?: string }>(`/${acc.igUserId}`, {
        fields: "username,followers_count,profile_picture_url",
        access_token: token,
      });

      const fields = "id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url,like_count,comments_count";
      const feed = await ig<{ data: Media[] }>(`/${acc.igUserId}/media`, { fields, limit: "40", access_token: token });
      let stories: Media[] = [];
      try {
        stories = (await ig<{ data: Media[] }>(`/${acc.igUserId}/stories`, { fields, access_token: token })).data ?? [];
      } catch {
        /* conta sem stories ativos ou sem permissão */
      }

      const knownBy = new Map(known.map((k) => [k.mediaId, k]));
      const now = Date.now();
      const posts = [];
      for (const m of [...(feed.data ?? []), ...stories.map((s) => ({ ...s, media_product_type: "STORY" }))]) {
        const ts = parseTime(m.timestamp);
        if (now - ts > 60 * DAY) continue;
        const prev = knownBy.get(m.id);
        const age = now - ts;
        const story = m.media_product_type === "STORY";
        // Métricas: stories sempre (somem em 24h); posts da última semana a cada hora;
        // até 30 dias, uma vez por dia; depois disso ficam como estão.
        const due = story || !prev || age < 7 * DAY || (age < 30 * DAY && now - prev.insightsAt > DAY);
        const metrics = due ? await insights(m.id, token, story) : null;
        posts.push({
          mediaId: m.id,
          permalink: m.permalink,
          caption: m.caption?.slice(0, 500),
          mediaType: m.media_type,
          productType: m.media_product_type,
          timestamp: ts,
          thumbnailUrl: m.thumbnail_url ?? (m.media_type === "VIDEO" ? undefined : m.media_url),
          likes: m.like_count,
          comments: m.comments_count,
          metrics: metrics
            ? {
                reach: metrics.reach,
                views: metrics.views,
                saved: metrics.saved,
                shares: metrics.shares,
                interactions: metrics.total_interactions,
                likes: metrics.likes,
                comments: metrics.comments,
              }
            : undefined,
        });
      }
      await ctx.runMutation(internal.instagram.savePosts, {
        clientId,
        username: me.username,
        followers: me.followers_count,
        pictureUrl: me.profile_picture_url,
        posts,
      });
    } catch (err) {
      await ctx.runMutation(internal.instagram.patchAccount, { clientId, lastError: (err as Error).message.slice(0, 300) });
    }
  },
});

export const patchAccount = internalMutation({
  args: { clientId: v.id("clients"), token: v.optional(v.string()), tokenExpiresAt: v.optional(v.number()), lastError: v.optional(v.string()) },
  handler: async (ctx, { clientId, ...patch }) => {
    const acc = await ctx.db
      .query("igAccounts")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .first();
    if (acc) await ctx.db.patch(acc._id, patch);
  },
});

const num = v.optional(v.number());
const postV = v.object({
  mediaId: v.string(),
  permalink: v.optional(v.string()),
  caption: v.optional(v.string()),
  mediaType: v.string(),
  productType: v.optional(v.string()),
  timestamp: v.number(),
  thumbnailUrl: v.optional(v.string()),
  likes: num,
  comments: num,
  metrics: v.optional(v.object({ reach: num, views: num, saved: num, shares: num, interactions: num, likes: num, comments: num })),
});

/** Formato do Hub que corresponde ao tipo de post do Instagram. */
function hubFormats(mediaType: string, productType?: string): Doc<"contents">["format"][] {
  if (productType === "STORY") return ["stories"];
  if (productType === "REELS") return ["reels", "video"];
  if (mediaType === "CAROUSEL_ALBUM") return ["carrossel"];
  if (mediaType === "VIDEO") return ["video", "reels"];
  return ["imagem"];
}

/** Liga o post do Instagram à peça do calendário e marca como postada. */
async function matchContent(ctx: MutationCtx, clientId: Id<"clients">, p: { permalink?: string; mediaType: string; productType?: string; timestamp: number }, userId: Id<"users"> | null) {
  const date = spDate(p.timestamp);
  const sameDay = (
    await ctx.db
      .query("contents")
      .withIndex("by_client_date", (q) => q.eq("clientId", clientId).eq("date", date))
      .collect()
  ).filter((c) => !c.deletedAt);
  const byLink = p.permalink ? sameDay.find((c) => c.externalUrl === p.permalink) : undefined;
  if (byLink) return byLink;
  const formats = hubFormats(p.mediaType, p.productType);
  const candidates = sameDay.filter((c) => formats.includes(c.format) && ["aprovado", "agendado", "publicado"].includes(c.status) && !c.externalUrl);
  if (candidates.length !== 1) return null;
  const c = candidates[0];
  await ctx.db.patch(c._id, { status: "publicado", externalUrl: p.permalink });
  if (userId && c.status !== "publicado") {
    await logActivity(ctx, { clientId, contentId: c._id, userId, kind: "status", summary: "Marcado como postado (achado no Instagram)", before: c.status, after: "publicado" });
  }
  return c;
}

export const savePosts = internalMutation({
  args: {
    clientId: v.id("clients"),
    username: v.string(),
    followers: v.optional(v.number()),
    pictureUrl: v.optional(v.string()),
    posts: v.array(postV),
  },
  handler: async (ctx, { clientId, username, followers, pictureUrl, posts }) => {
    const acc = await ctx.db
      .query("igAccounts")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .first();
    if (!acc) return;
    await ctx.db.patch(acc._id, { username, followers, pictureUrl, lastSyncAt: Date.now(), lastError: undefined });

    if (followers !== undefined) {
      const date = spDate(Date.now());
      const today = await ctx.db
        .query("igFollowers")
        .withIndex("by_client_date", (q) => q.eq("clientId", clientId).eq("date", date))
        .first();
      if (today) await ctx.db.patch(today._id, { followers });
      else await ctx.db.insert("igFollowers", { clientId, date, followers });
    }

    const admin = (await ctx.db.query("users").collect()).find((u) => u.role === "admin") ?? null;
    for (const { metrics, ...p } of posts) {
      const existing = await ctx.db
        .query("igPosts")
        .withIndex("by_media", (q) => q.eq("mediaId", p.mediaId))
        .first();
      const m = metrics
        ? {
            reach: metrics.reach,
            views: metrics.views,
            saved: metrics.saved,
            shares: metrics.shares,
            interactions: metrics.interactions,
            likes: metrics.likes ?? p.likes,
            comments: metrics.comments ?? p.comments,
            insightsAt: Date.now(),
          }
        : { likes: p.likes ?? existing?.likes, comments: p.comments ?? existing?.comments };
      const base = {
        permalink: p.permalink,
        caption: p.caption,
        mediaType: p.mediaType,
        productType: p.productType,
        timestamp: p.timestamp,
        thumbnailUrl: p.thumbnailUrl ?? existing?.thumbnailUrl,
      };
      let id = existing?._id;
      if (existing) await ctx.db.patch(existing._id, { ...base, ...m });
      else id = await ctx.db.insert("igPosts", { clientId, mediaId: p.mediaId, ...base, ...m });
      if (!existing?.contentId) {
        const c = await matchContent(ctx, clientId, p, admin?._id ?? null);
        if (c && id) await ctx.db.patch(id, { contentId: c._id });
      }
    }
  },
});

/** Botão "Atualizar agora". */
export const syncNow = mutation({
  args: { clientSlug: v.string() },
  handler: async (ctx, { clientSlug }) => {
    await requireAdmin(ctx);
    const { client } = await requireClientBySlug(ctx, clientSlug);
    await ctx.scheduler.runAfter(0, internal.instagram.syncClient, { clientId: client._id });
  },
});

/* ---------- Leitura ---------- */

async function accountView(ctx: QueryCtx, clientId: Id<"clients">) {
  const acc = await ctx.db
    .query("igAccounts")
    .withIndex("by_client", (q) => q.eq("clientId", clientId))
    .first();
  if (!acc) return null;
  return {
    username: acc.username,
    pictureUrl: acc.pictureUrl ?? null,
    followers: acc.followers ?? null,
    lastSyncAt: acc.lastSyncAt ?? null,
    lastError: acc.lastError ?? null,
    expiresAt: acc.tokenExpiresAt,
  };
}

/** Status das conexões, para a tela de clientes. */
export const statusAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const clients = await ctx.db.query("clients").collect();
    const { appId, secret } = config();
    const out: Record<string, Awaited<ReturnType<typeof accountView>>> = {};
    for (const c of clients) out[c.slug] = await accountView(ctx, c._id);
    return { configured: !!(appId && secret), accounts: out };
  },
});

type PostRow = Doc<"igPosts">;

function sum(list: PostRow[], k: "reach" | "views" | "saved" | "shares" | "interactions" | "likes" | "comments") {
  return list.reduce((t, p) => t + (p[k] ?? 0), 0);
}

function formatOf(p: PostRow) {
  if (p.productType === "STORY") return "Stories";
  if (p.productType === "REELS") return "Reels";
  if (p.mediaType === "CAROUSEL_ALBUM") return "Carrossel";
  if (p.mediaType === "VIDEO") return "Vídeo";
  return "Post";
}

function totals(list: PostRow[]) {
  const reach = sum(list, "reach");
  const interactions = sum(list, "interactions") || sum(list, "likes") + sum(list, "comments") + sum(list, "saved") + sum(list, "shares");
  return {
    posts: list.length,
    reach,
    views: sum(list, "views"),
    interactions,
    saved: sum(list, "saved"),
    shares: sum(list, "shares"),
    engagement: reach > 0 ? interactions / reach : 0,
  };
}

/** Relatório do período (semana ou mês) com comparação ao período anterior. */
export const report = query({
  args: { slug: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, { slug, from, to }) => {
    const { viewer, client } = await requireClientBySlug(ctx, slug);
    if (viewer.role !== "admin") throw new ConvexError("O relatório é do estúdio.");
    const account = await accountView(ctx, client._id);
    if (!account) return { account: null };

    const start = Date.parse(`${from}T03:00:00Z`);
    const end = Date.parse(`${to}T03:00:00Z`) + DAY;
    const span = end - start;
    const rows = await ctx.db
      .query("igPosts")
      .withIndex("by_client_time", (q) => q.eq("clientId", client._id).gte("timestamp", start - span).lt("timestamp", end))
      .collect();
    const current = rows.filter((p) => p.timestamp >= start);
    const previous = rows.filter((p) => p.timestamp < start);

    const followers = await ctx.db
      .query("igFollowers")
      .withIndex("by_client_date", (q) => q.eq("clientId", client._id).gte("date", spDate(start - DAY)).lte("date", to))
      .collect();
    const firstF = followers[0]?.followers ?? null;
    const lastF = followers[followers.length - 1]?.followers ?? account.followers;

    const score = (p: PostRow) => (p.interactions ?? (p.likes ?? 0) + (p.comments ?? 0) + (p.saved ?? 0) + (p.shares ?? 0)) * 1000 + (p.reach ?? 0);
    const feed = current.filter((p) => p.productType !== "STORY");
    const posts = [...current].sort((a, b) => b.timestamp - a.timestamp);
    const top = [...feed].sort((a, b) => score(b) - score(a)).slice(0, 3);

    const byFormat = new Map<string, PostRow[]>();
    for (const p of current) byFormat.set(formatOf(p), [...(byFormat.get(formatOf(p)) ?? []), p]);

    const shape = (p: PostRow) => ({
      _id: p._id,
      permalink: p.permalink ?? null,
      caption: p.caption ?? null,
      format: formatOf(p),
      date: spDate(p.timestamp),
      thumbnailUrl: p.thumbnailUrl ?? null,
      reach: p.reach ?? null,
      views: p.views ?? null,
      likes: p.likes ?? null,
      comments: p.comments ?? null,
      saved: p.saved ?? null,
      shares: p.shares ?? null,
      interactions: p.interactions ?? null,
      contentId: p.contentId ?? null,
    });

    return {
      account,
      totals: totals(current),
      previous: totals(previous),
      followers: { start: firstF, end: lastF, gained: firstF !== null && lastF !== null ? lastF - firstF : null },
      top: top.map(shape),
      formats: [...byFormat.entries()]
        .map(([format, list]) => ({ format, ...totals(list) }))
        .sort((a, b) => b.reach - a.reach),
      posts: posts.map(shape),
    };
  },
});

/** Resumo da semana de todos os clientes, para a página inicial. */
export const weekSummary = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    await requireAdmin(ctx);
    const start = Date.parse(`${from}T03:00:00Z`);
    const end = Date.parse(`${to}T03:00:00Z`) + DAY;
    const span = end - start;
    const out = [];
    for (const c of (await ctx.db.query("clients").collect()).filter((c) => c.active)) {
      const account = await accountView(ctx, c._id);
      if (!account) continue;
      const rows = await ctx.db
        .query("igPosts")
        .withIndex("by_client_time", (q) => q.eq("clientId", c._id).gte("timestamp", start - span).lt("timestamp", end))
        .collect();
      const cur = totals(rows.filter((p) => p.timestamp >= start));
      const prev = totals(rows.filter((p) => p.timestamp < start));
      const best = rows
        .filter((p) => p.timestamp >= start && p.productType !== "STORY")
        .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))[0];
      out.push({
        slug: c.slug,
        name: c.name,
        accentColor: c.accentColor,
        username: account.username,
        followers: account.followers,
        current: cur,
        previous: prev,
        best: best ? { caption: best.caption ?? null, thumbnailUrl: best.thumbnailUrl ?? null, reach: best.reach ?? null, permalink: best.permalink ?? null } : null,
      });
    }
    return out;
  },
});
