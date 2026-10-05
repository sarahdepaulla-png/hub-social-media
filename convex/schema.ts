import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const role = v.union(v.literal("admin"), v.literal("cliente"));

export const status = v.union(
  v.literal("ideia"),
  v.literal("producao"),
  v.literal("aguardando"),
  v.literal("ajuste"),
  v.literal("aprovado"),
  v.literal("agendado"),
  v.literal("publicado"),
);

export const platform = v.union(
  v.literal("instagram"),
  v.literal("tiktok"),
  v.literal("youtube"),
  v.literal("linkedin"),
  v.literal("outra"),
);

export const format = v.union(
  v.literal("imagem"),
  v.literal("carrossel"),
  v.literal("reels"),
  v.literal("stories"),
  v.literal("video"),
  v.literal("link"),
);

export const decisionType = v.union(
  v.literal("aprovar"),
  v.literal("aprovar_obs"),
  v.literal("ajuste"),
);

export default defineSchema({
  ...authTables,

  // Usuário do Convex Auth estendido com papel e workspace.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(role),
    clientId: v.optional(v.id("clients")),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_client", ["clientId"]),

  // Quem pode entrar. Criado pela admin; aplicado no primeiro login.
  invites: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    role,
    clientId: v.optional(v.id("clients")),
    acceptedAt: v.optional(v.number()),
    token: v.optional(v.string()), // link de acesso sem e-mail: /acesso/<token>
  })
    .index("by_email", ["email"])
    .index("by_token", ["token"]),

  clients: defineTable({
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    niches: v.array(v.string()),
    accentColor: v.string(),
    secondaryColor: v.optional(v.string()),
    logoId: v.optional(v.id("_storage")),
    photoId: v.optional(v.id("_storage")),
    active: v.boolean(),
  }).index("by_slug", ["slug"]),

  contents: defineTable({
    clientId: v.id("clients"),
    date: v.string(), // AAAA-MM-DD
    time: v.optional(v.string()), // HH:MM
    platform,
    format,
    title: v.string(),
    objective: v.optional(v.string()),
    pillar: v.optional(v.string()),
    status,
    version: v.number(),
    coverId: v.optional(v.id("_storage")),
    coverUrl: v.optional(v.string()),
    // De onde veio a capa: primeira imagem, quadro do vídeo ou enviada à mão.
    coverSource: v.optional(v.union(v.literal("imagem"), v.literal("quadro"), v.literal("manual"))),
    externalUrl: v.optional(v.string()),
    sourceIdeaId: v.optional(v.id("ideas")),
    sourceOpportunityId: v.optional(v.id("opportunities")),
    importKey: v.optional(v.string()), // peças criadas pela fila de conteúdo (pasta conteudo/)
  })
    .index("by_import_key", ["importKey"])
    .index("by_client_date", ["clientId", "date"])
    .index("by_client_status", ["clientId", "status"]),

  media: defineTable({
    contentId: v.id("contents"),
    version: v.number(),
    order: v.number(),
    kind: v.union(v.literal("imagem"), v.literal("video"), v.literal("link")),
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    alt: v.optional(v.string()),
  }).index("by_content_version", ["contentId", "version", "order"]),

  captions: defineTable({
    contentId: v.id("contents"),
    order: v.number(),
    text: v.string(),
    cta: v.optional(v.string()),
    hashtags: v.optional(v.string()),
    notes: v.optional(v.string()),
    chosenBy: v.optional(v.id("users")),
    chosenAt: v.optional(v.number()),
  }).index("by_content", ["contentId", "order"]),

  decisions: defineTable({
    contentId: v.id("contents"),
    clientId: v.id("clients"),
    version: v.number(),
    type: decisionType,
    comment: v.optional(v.string()),
    userId: v.id("users"),
    previousStatus: v.optional(status),
    undoneAt: v.optional(v.number()),
  }).index("by_content", ["contentId"]),

  comments: defineTable({
    contentId: v.id("contents"),
    clientId: v.id("clients"),
    parentId: v.optional(v.id("comments")),
    authorId: v.id("users"),
    body: v.string(),
    mediaOrder: v.optional(v.number()), // card do carrossel citado
    decisionId: v.optional(v.id("decisions")), // comentário que veio junto de uma decisão
  }).index("by_content", ["contentId"]),

  ideas: defineTable({
    clientId: v.id("clients"),
    authorId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    link: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
    status: v.union(v.literal("nova"), v.literal("analise"), v.literal("convertida"), v.literal("arquivada")),
    contentId: v.optional(v.id("contents")),
    opportunityId: v.optional(v.id("opportunities")), // pedido feito a partir de uma data
    adaptation: v.optional(v.string()), // como dá para adaptar a referência
    previewId: v.optional(v.id("_storage")), // imagem tirada do link
    previewTitle: v.optional(v.string()),
    previewStatus: v.optional(v.union(v.literal("pendente"), v.literal("ok"), v.literal("falhou"))),
    likedBy: v.optional(v.array(v.id("users"))),
  }).index("by_client", ["clientId"]),

  // Conversa em cada cartão do mural de ideias.
  ideaComments: defineTable({
    ideaId: v.id("ideas"),
    clientId: v.id("clients"),
    authorId: v.id("users"),
    body: v.string(),
  }).index("by_idea", ["ideaId"]),

  // Biblioteca de datas. Sem clientId = vale para todo cliente dos nichos listados.
  opportunities: defineTable({
    date: v.string(), // AAAA-MM-DD; para "mês todo", use o dia 01 e allMonth
    allMonth: v.optional(v.boolean()),
    title: v.string(),
    hint: v.optional(v.string()),
    niches: v.array(v.string()),
    clientId: v.optional(v.id("clients")),
  }).index("by_date", ["date"]),

  activity: defineTable({
    clientId: v.id("clients"),
    contentId: v.optional(v.id("contents")),
    userId: v.id("users"),
    kind: v.string(), // status, decisao, comentario, versao, edicao, ideia
    summary: v.string(),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
  })
    .index("by_content", ["contentId"])
    .index("by_client", ["clientId"]),
});
