/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const modules = import.meta.glob("../convex/**/!(*.*.*)*.*s");

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.seed.run, { month: "2026-10" });
  const ids = await t.run(async (ctx) => {
    const lili = (await ctx.db.query("clients").withIndex("by_slug", (q) => q.eq("slug", "lili")).unique())!;
    const bia = (await ctx.db.query("clients").withIndex("by_slug", (q) => q.eq("slug", "bia")).unique())!;
    const admin = await ctx.db.insert("users", { email: "sarah@hub.com", name: "Sarah", role: "admin" });
    const liliUser = await ctx.db.insert("users", { email: "lili@x.com", name: "Lili", role: "cliente", clientId: lili._id });
    const biaUser = await ctx.db.insert("users", { email: "bia@x.com", name: "Bia", role: "cliente", clientId: bia._id });
    const contents = await ctx.db.query("contents").withIndex("by_client_date", (q) => q.eq("clientId", lili._id)).collect();
    const waiting = contents.filter((c) => c.status === "aguardando");
    const biaContent = (await ctx.db.query("contents").withIndex("by_client_date", (q) => q.eq("clientId", bia._id)).first())!;
    return { lili: lili._id, admin, liliUser, biaUser, waiting: waiting.map((c) => c._id), biaContent: biaContent._id };
  });
  const as = (userId: Id<"users">) => t.withIdentity({ subject: `${userId}|sessao` });
  return { t, ...ids, as };
}

describe("acesso", () => {
  test("cliente só vê o próprio workspace", async () => {
    const { as, liliUser, biaContent } = await setup();
    await expect(as(liliUser).query(api.clients.bySlug, { slug: "bia" })).rejects.toThrow(/não encontrado/);
    await expect(as(liliUser).query(api.contents.get, { contentId: biaContent })).rejects.toThrow(/não encontrado/);
    const ws = await as(liliUser).query(api.clients.bySlug, { slug: "lili" });
    expect(ws.name).toBe("Lili");
  });

  test("sem login não lê nada", async () => {
    const { t } = await setup();
    await expect(t.query(api.clients.bySlug, { slug: "lili" })).rejects.toThrow(/Sem acesso/);
  });

  test("cliente não usa funções de admin", async () => {
    const { as, liliUser, waiting } = await setup();
    await expect(as(liliUser).mutation(api.contents.setStatus, { contentId: waiting[0], status: "publicado" })).rejects.toThrow(/administradora/);
    await expect(as(liliUser).query(api.clients.listForStudio, { month: "2026-10", today: "2026-10-05" })).rejects.toThrow(/administradora/);
  });

  test("admin vê todos os clientes", async () => {
    const { as, admin } = await setup();
    const rows = await as(admin).query(api.clients.listForStudio, { month: "2026-10", today: "2026-10-05" });
    expect(rows.map((r) => r.slug).sort()).toEqual(["bia", "entalpia", "lili", "vivi"]);
    expect(rows[0].slug).toBe("lili"); // tem ajuste pedido: vai para o topo
  });
});

describe("início", () => {
  test("contadores batem com o seed", async () => {
    const { as, liliUser } = await setup();
    const d = await as(liliUser).query(api.dashboard.forClient, { slug: "lili", month: "2026-10", today: "2026-10-05" });
    expect(d.counts).toMatchObject({ total: 12, publicados: 2, aprovados: 3, aguardando: 4, ajuste: 1, producao: 2 });
    expect(d.waiting.map((w) => w.date)).toEqual(["2026-10-13", "2026-10-15", "2026-10-20", "2026-10-29"]);
  });
});

describe("decisão", () => {
  test("aprovar registra usuário, data e muda o status", async () => {
    const { t, as, liliUser, waiting } = await setup();
    await as(liliUser).mutation(api.contents.decide, { contentId: waiting[0], type: "aprovar" });
    const view = await as(liliUser).query(api.contents.get, { contentId: waiting[0] });
    expect(view.content.status).toBe("aprovado");
    expect(view.decision).toMatchObject({ type: "aprovar", userName: "Lili", isMine: true });
    expect(view.queue.remaining).toBe(3);
    const log = await t.run((ctx) => ctx.db.query("activity").collect());
    expect(log.some((a) => a.kind === "decisao" && a.userId === liliUser)).toBe(true);
  });

  test("ajuste exige comentário e o comentário entra na conversa", async () => {
    const { as, liliUser, waiting } = await setup();
    await expect(as(liliUser).mutation(api.contents.decide, { contentId: waiting[1], type: "ajuste" })).rejects.toThrow(/precisa mudar/);
    await as(liliUser).mutation(api.contents.decide, { contentId: waiting[1], type: "ajuste", comment: "Troca a foto do card 3", mediaOrder: 3 });
    const view = await as(liliUser).query(api.contents.get, { contentId: waiting[1] });
    expect(view.content.status).toBe("ajuste");
    expect(view.comments[0]).toMatchObject({ body: "Troca a foto do card 3", mediaOrder: 3, decisionLabel: "Ajuste solicitado" });
  });

  test("não decide duas vezes", async () => {
    const { as, liliUser, waiting } = await setup();
    await as(liliUser).mutation(api.contents.decide, { contentId: waiting[0], type: "aprovar" });
    await expect(as(liliUser).mutation(api.contents.decide, { contentId: waiting[0], type: "aprovar" })).rejects.toThrow(/não está esperando/);
  });

  test("desfazer volta o status e apaga o comentário da decisão", async () => {
    const { as, liliUser, admin, waiting } = await setup();
    const { decisionId } = await as(liliUser).mutation(api.contents.decide, {
      contentId: waiting[2],
      type: "aprovar_obs",
      comment: "Só confere a hashtag",
    });
    await expect(as(admin).mutation(api.contents.undoDecision, { decisionId })).rejects.toThrow(/Só quem decidiu/);
    await as(liliUser).mutation(api.contents.undoDecision, { decisionId });
    const view = await as(liliUser).query(api.contents.get, { contentId: waiting[2] });
    expect(view.content.status).toBe("aguardando");
    expect(view.decision).toBeNull();
    expect(view.comments).toHaveLength(0);
  });
});

describe("legendas", () => {
  test("escolher favorita e manter a escolha ao editar", async () => {
    const { as, liliUser, admin, waiting } = await setup();
    const before = await as(liliUser).query(api.contents.get, { contentId: waiting[0] });
    const second = before.captions[1]._id;
    await as(liliUser).mutation(api.contents.chooseCaption, { captionId: second });
    let view = await as(liliUser).query(api.contents.get, { contentId: waiting[0] });
    expect(view.captions.map((c) => c.chosen)).toEqual([false, true]);

    await as(admin).mutation(api.captions.save, {
      contentId: waiting[0],
      items: [
        { _id: view.captions[1]._id, text: "Texto revisado" },
        { text: "Opção nova", cta: "Salva" },
      ],
    });
    view = await as(liliUser).query(api.contents.get, { contentId: waiting[0] });
    expect(view.captions).toHaveLength(2);
    expect(view.captions[0]).toMatchObject({ text: "Texto revisado", chosen: true, order: 1 });
  });
});

describe("editor", () => {
  test("não envia para aprovação sem mídia", async () => {
    const { as, admin } = await setup();
    const id = await as(admin).mutation(api.contents.create, { clientSlug: "vivi", date: "2026-10-20", title: "Acupuntura", platform: "instagram", format: "carrossel" });
    await expect(as(admin).mutation(api.contents.setStatus, { contentId: id, status: "aguardando" })).rejects.toThrow(/mídia ou um link/);
    await as(admin).mutation(api.media.add, { contentId: id, kind: "link", url: "https://drive.google.com/x" });
    await as(admin).mutation(api.contents.setStatus, { contentId: id, status: "aguardando" });
  });

  test("nova versão guarda a anterior e copia a mídia", async () => {
    const { t, as, admin, waiting } = await setup();
    await as(admin).mutation(api.media.add, { contentId: waiting[0], kind: "link", url: "https://a.com/1" });
    await as(admin).mutation(api.media.add, { contentId: waiting[0], kind: "link", url: "https://a.com/2" });
    await as(admin).mutation(api.contents.newVersion, { contentId: waiting[0], copyMedia: true });
    const view = await as(admin).query(api.contents.get, { contentId: waiting[0] });
    expect(view.content).toMatchObject({ version: 2, status: "producao" });
    expect(view.media).toHaveLength(2);
    const all = await t.run((ctx) => ctx.db.query("media").collect());
    expect(all).toHaveLength(4);

    const [first] = view.media;
    await as(admin).mutation(api.media.move, { mediaId: first._id, direction: 1 });
    const moved = await as(admin).query(api.contents.get, { contentId: waiting[0] });
    expect(moved.media.map((m) => m.url)).toEqual(["https://a.com/2", "https://a.com/1"]);
  });

  test("comentário e resposta formam a thread", async () => {
    const { as, admin, liliUser, waiting } = await setup();
    const root = await as(liliUser).mutation(api.comments.add, { contentId: waiting[0], body: "Pode trocar a cor?" });
    await as(admin).mutation(api.comments.add, { contentId: waiting[0], body: "Trocada", parentId: root });
    const view = await as(liliUser).query(api.contents.get, { contentId: waiting[0] });
    expect(view.comments.find((c) => c.parentId === root)).toMatchObject({ body: "Trocada", author: { role: "admin" } });
    const history = await as(liliUser).query(api.contents.history, { contentId: waiting[0] });
    expect(history.filter((h) => h.kind === "comentario")).toHaveLength(2);
  });
});

describe("calendário e datas", () => {
  test("mês traz peças e só as datas do nicho do cliente", async () => {
    const { as, liliUser, admin } = await setup();
    const lili = await as(liliUser).query(api.calendar.month, { slug: "lili", month: "2026-10" });
    expect(lili.contents).toHaveLength(12);
    const titles = lili.opportunities.map((o) => o.title);
    expect(titles).toContain("Dia do Fisioterapeuta e do Terapeuta Ocupacional");
    expect(titles).not.toContain("Halloween");
    const entalpia = await as(admin).query(api.calendar.month, { slug: "entalpia", month: "2026-10" });
    expect(entalpia.opportunities.map((o) => o.title)).toEqual(["Dia Internacional da Música", "Halloween"]);
  });

  test("cliente pede conteúdo sobre a data e a admin cria a partir dela", async () => {
    const { as, liliUser, admin } = await setup();
    const range = { slug: "lili", from: "2026-10-05", to: "2026-12-31" };
    let opps = await as(liliUser).query(api.opportunities.forClient, range);
    const coluna = opps.find((o) => o.title === "Dia Mundial da Coluna")!;
    await as(liliUser).mutation(api.opportunities.request, { slug: "lili", opportunityId: coluna._id });
    await as(liliUser).mutation(api.opportunities.request, { slug: "lili", opportunityId: coluna._id }); // não duplica
    let ideas = await as(admin).query(api.ideas.list, { slug: "lili" });
    expect(ideas.filter((i) => i.title === "Dia Mundial da Coluna")).toHaveLength(1);

    const contentId = await as(admin).mutation(api.contents.create, {
      clientSlug: "lili",
      date: coluna.date,
      title: coluna.title,
      platform: "instagram",
      format: "reels",
      sourceOpportunityId: coluna._id,
    });
    opps = await as(liliUser).query(api.opportunities.forClient, range);
    expect(opps.find((o) => o._id === coluna._id)?.contentId).toBe(contentId);
    ideas = await as(liliUser).query(api.ideas.list, { slug: "lili" });
    expect(ideas[0]).toMatchObject({ status: "convertida", content: { _id: contentId } });
  });

  test("só admin mexe na biblioteca", async () => {
    const { as, liliUser, admin } = await setup();
    await expect(as(liliUser).mutation(api.opportunities.create, { date: "2026-11-10", title: "X", niches: ["fisioterapia"] })).rejects.toThrow(/administradora/);
    await expect(as(admin).mutation(api.opportunities.create, { date: "2026-11-10", title: "X", niches: [] })).rejects.toThrow(/nicho/);
    await as(admin).mutation(api.opportunities.create, { date: "2026-11-10", title: "Só da Bia", niches: [], clientSlug: "bia" });
    const lili = await as(liliUser).query(api.calendar.month, { slug: "lili", month: "2026-11" });
    expect(lili.opportunities.map((o) => o.title)).not.toContain("Só da Bia");
  });
});

describe("ideias", () => {
  test("cliente envia, admin leva ao calendário", async () => {
    const { as, liliUser, biaUser, admin } = await setup();
    const ideaId = await as(liliUser).mutation(api.ideas.create, { slug: "lili", title: "Bastidores", link: "https://instagram.com/p/x" });
    await expect(as(liliUser).mutation(api.ideas.create, { slug: "lili", title: "Y", link: "instagram.com" })).rejects.toThrow(/https/);
    await expect(as(biaUser).query(api.ideas.list, { slug: "lili" })).rejects.toThrow(/não encontrado/);
    const contentId = await as(admin).mutation(api.contents.create, {
      clientSlug: "lili",
      date: "2026-10-28",
      title: "Bastidores",
      platform: "instagram",
      format: "stories",
      sourceIdeaId: ideaId,
    });
    const [idea] = await as(liliUser).query(api.ideas.list, { slug: "lili" });
    expect(idea).toMatchObject({ status: "convertida", content: { _id: contentId, date: "2026-10-28" } });
    await expect(as(liliUser).mutation(api.ideas.remove, { ideaId })).rejects.toThrow(/com o estúdio/);
  });
});

describe("clientes e acessos", () => {
  test("cria cliente e libera acesso para quem já tinha conta", async () => {
    const { t, as, admin } = await setup();
    await expect(as(admin).mutation(api.clients.create, { slug: "Clínica X", name: "X", niches: [], accentColor: "#123456" })).rejects.toThrow(/endereço/);
    await expect(as(admin).mutation(api.clients.create, { slug: "lili", name: "X", niches: [], accentColor: "#123456" })).rejects.toThrow(/Já existe/);
    await as(admin).mutation(api.clients.create, { slug: "clinica-x", name: "Clínica X", niches: ["clinica"], accentColor: "#123456" });

    const lost = await t.run((ctx) => ctx.db.insert("users", { email: "nova@x.com" }));
    await expect(as(lost).query(api.clients.bySlug, { slug: "clinica-x" })).rejects.toThrow(/Sem acesso/);
    await as(admin).mutation(api.invites.create, { email: "Nova@X.com", role: "cliente", clientSlug: "clinica-x" });
    const ws = await as(lost).query(api.clients.bySlug, { slug: "clinica-x" });
    expect(ws.name).toBe("Clínica X");

    const [person] = (await as(admin).query(api.clients.listAdmin, {})).find((c) => c.slug === "clinica-x")!.people;
    await as(admin).mutation(api.invites.revoke, { inviteId: person._id });
    await expect(as(lost).query(api.clients.bySlug, { slug: "clinica-x" })).rejects.toThrow(/Sem acesso/);
  });
});

describe("link de acesso", () => {
  test("link entra no workspace certo e para de funcionar ao tirar o acesso", async () => {
    const { t, as, admin } = await setup();
    await as(admin).mutation(api.invites.create, { email: "vivi@x.com", name: "Vivi", role: "cliente", clientSlug: "vivi" });
    const vivi = (await as(admin).query(api.clients.listAdmin, {})).find((c) => c.slug === "vivi")!;
    const person = vivi.people[0];
    expect(person.token).toHaveLength(32);

    const userId = (await t.mutation(internal.access.userForToken, { token: person.token! }))!;
    expect(userId).toBeTruthy();
    const ws = await as(userId).query(api.clients.bySlug, { slug: "vivi" });
    expect(ws.name).toBe("Vivi");
    await expect(as(userId).query(api.clients.bySlug, { slug: "lili" })).rejects.toThrow(/não encontrado/);

    // Segunda entrada pelo mesmo link reaproveita o usuário.
    expect(await t.mutation(internal.access.userForToken, { token: person.token! })).toBe(userId);
    expect(await t.mutation(internal.access.userForToken, { token: "x".repeat(32) })).toBeNull();

    await as(admin).mutation(api.invites.resetLink, { inviteId: person._id });
    expect(await t.mutation(internal.access.userForToken, { token: person.token! })).toBeNull();

    await as(admin).mutation(api.invites.revoke, { inviteId: person._id });
    await expect(as(userId).query(api.clients.bySlug, { slug: "vivi" })).rejects.toThrow(/Sem acesso/);
  });

  test("deploy gera link de admin", async () => {
    const { t } = await setup();
    const [link] = await t.mutation(internal.access.ensureAdminLinks, { emails: ["Dona@Hub.com"] });
    const userId = (await t.mutation(internal.access.userForToken, { token: link.token }))!;
    const rows = await t.withIdentity({ subject: `${userId}|s` }).query(api.clients.listForStudio, { month: "2026-10", today: "2026-10-05" });
    expect(rows).toHaveLength(4);
    const again = await t.mutation(internal.access.ensureAdminLinks, { emails: ["dona@hub.com"] });
    expect(again[0].token).toBe(link.token);
  });
});

describe("fila de conteúdo", () => {
  test("cria, atualiza sem duplicar e respeita o que a cliente decidiu", async () => {
    const { t, as, admin } = await setup();
    const items = JSON.parse(await (await import("node:fs/promises")).readFile("conteudo/vivi-2026-10.json", "utf8"));
    await t.mutation(internal.imports.apply, { items });
    await t.mutation(internal.imports.apply, { items });
    let month = await as(admin).query(api.calendar.month, { slug: "vivi", month: "2026-10" });
    expect(month.contents.map((c) => c.title)).toHaveLength(4);
    const first = month.contents.find((c) => c.date === "2026-10-05")!;
    const view = await as(admin).query(api.contents.get, { contentId: first._id });
    expect(view.captions).toHaveLength(2);
    expect(view.content.status).toBe("producao");

    await t.run((ctx) => ctx.db.patch(first._id, { status: "aprovado" }));
    await t.mutation(internal.imports.apply, { items: [{ ...items[0], date: "2026-10-30" }] });
    month = await as(admin).query(api.calendar.month, { slug: "vivi", month: "2026-10" });
    expect(month.contents.find((c) => c._id === first._id)?.date).toBe("2026-10-05");

    const moved = await t.mutation(internal.imports.apply, { items: [{ ...items[1], date: "2026-10-09" }] });
    expect(moved).toContain("atualizada");
  });
});

describe("capas", () => {
  test("imagem vira capa, quadro de vídeo não passa por cima, capa manual tem prioridade", async () => {
    const { t, as, admin, waiting } = await setup();
    const store = (text: string) => t.run((ctx) => ctx.storage.store(new Blob([text], { type: "image/jpeg" })));
    const id = waiting[0];
    const cover = async () => (await as(admin).query(api.contents.get, { contentId: id })).content;

    // Só vídeo: sem capa, aparece na lista de capas a gerar.
    const video = await store("video");
    await as(admin).mutation(api.media.add, { contentId: id, kind: "video", storageId: video });
    expect((await cover()).coverSource).toBeNull();
    const missing = await as(admin).query(api.media.missingCovers, {});
    expect(missing.map((m) => m.contentId)).toContain(id);

    // Quadro do vídeo vira capa.
    await as(admin).mutation(api.media.setCover, { contentId: id, storageId: await store("frame"), source: "quadro" });
    expect((await cover()).coverSource).toBe("quadro");
    expect((await as(admin).query(api.media.missingCovers, {})).map((m) => m.contentId)).not.toContain(id);

    // Imagem chega: passa a ser a capa.
    await as(admin).mutation(api.media.add, { contentId: id, kind: "imagem", storageId: await store("img") });
    expect((await cover()).coverSource).toBe("imagem");

    // Capa manual ganha de tudo e não é trocada por novas imagens.
    await as(admin).mutation(api.media.setCover, { contentId: id, storageId: await store("manual"), source: "manual" });
    await as(admin).mutation(api.media.add, { contentId: id, kind: "imagem", storageId: await store("img2") });
    expect((await cover()).coverSource).toBe("manual");
    await as(admin).mutation(api.media.setCover, { contentId: id, storageId: await store("frame2"), source: "quadro" });
    expect((await cover()).coverSource).toBe("manual");

    // Voltar para automática usa a primeira imagem.
    await as(admin).mutation(api.media.resetCover, { contentId: id });
    expect((await cover()).coverSource).toBe("imagem");

    // Capa aparece no Estúdio e no mês.
    const rows = await as(admin).query(api.clients.listForStudio, { month: "2026-10", today: "2026-10-05" });
    const lili = rows.find((r) => r.slug === "lili")!;
    expect(lili.strip.find((s) => s._id === id)?.coverUrl).toBeTruthy();
  });

  test("cliente não troca capa", async () => {
    const { t, as, liliUser, waiting } = await setup();
    const sid = await t.run((ctx) => ctx.storage.store(new Blob(["x"], { type: "image/jpeg" })));
    await expect(as(liliUser).mutation(api.media.setCover, { contentId: waiting[0], storageId: sid, source: "manual" })).rejects.toThrow(/administradora/);
    expect(await as(liliUser).query(api.media.missingCovers, {})).toEqual([]);
  });
});

describe("mural de referências", () => {
  test("lê og:image e título, inclusive com atributos invertidos", async () => {
    const { parsePreview, platformOf, youtubeId } = await import("../convex/lib/preview");
    const html = `<html><head><title>Fallback</title>
      <meta content="https://cdn.site.com/a.jpg?x=1&amp;y=2" property="og:image">
      <meta property="og:title" content="5 erros no alongamento &#39;posteriores&#39;"></head></html>`;
    expect(parsePreview(html, "https://site.com/p/1")).toEqual({
      image: "https://cdn.site.com/a.jpg?x=1&y=2",
      title: "5 erros no alongamento 'posteriores'",
    });
    expect(parsePreview(`<meta name="twitter:image" content="/img/c.png"><title>Oi</title>`, "https://ex.com/a/b").image).toBe("https://ex.com/img/c.png");
    expect(parsePreview("<title>Instagram</title>", "https://instagram.com/p/x").title).toBeNull();
    expect(platformOf("https://www.instagram.com/reel/abc/")).toBe("instagram");
    expect(platformOf("https://vm.tiktok.com/xyz")).toBe("tiktok");
    expect(platformOf("https://br.pinterest.com/pin/1")).toBe("pinterest");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/shorts/abcDEF123")).toBe("abcDEF123");
  });

  test("referência só com link ganha título automático e fica buscando a imagem", async () => {
    const { as, liliUser, admin } = await setup();
    await as(liliUser).mutation(api.ideas.create, { slug: "lili", link: "https://www.instagram.com/p/abc/", adaptation: "Gostei do boneco" });
    const [idea] = await as(liliUser).query(api.ideas.list, { slug: "lili" });
    expect(idea).toMatchObject({ title: "Referência do Instagram", platform: "instagram", previewPending: true, adaptation: "Gostei do boneco", status: "nova", canEdit: true });
    await expect(as(liliUser).mutation(api.ideas.create, { slug: "lili" })).rejects.toThrow(/Cole um link/);

    // Admin complementa a adaptação; o que a admin cria não conta como "nova".
    await as(admin).mutation(api.ideas.update, { ideaId: idea._id, adaptation: "Versão com os erros da clínica" });
    await as(admin).mutation(api.ideas.create, { slug: "lili", title: "Trend do áudio" });
    const list = await as(admin).query(api.ideas.list, { slug: "lili" });
    expect(list.find((i) => i._id === idea._id)?.adaptation).toBe("Versão com os erros da clínica");
    expect(list.find((i) => i.title === "Trend do áudio")?.status).toBe("analise");
    const ws = await as(admin).query(api.clients.bySlug, { slug: "lili" });
    expect(ws.newIdeas).toBe(1);
    const strip = await as(liliUser).query(api.ideas.latest, { slug: "lili" });
    expect(strip).toHaveLength(2);
  });

  test("cliente não edita referência de outra pessoa", async () => {
    const { as, liliUser, admin } = await setup();
    const id = await as(admin).mutation(api.ideas.create, { slug: "lili", title: "Do estúdio" });
    await expect(as(liliUser).mutation(api.ideas.update, { ideaId: id, adaptation: "x" })).rejects.toThrow(/Só quem enviou/);
  });
});

describe("curtir, comentar e editar cartões", () => {
  test("cliente curte e comenta; comentário traz a ideia de volta para o estúdio", async () => {
    const { as, liliUser, admin, biaUser } = await setup();
    const id = await as(admin).mutation(api.ideas.create, { slug: "lili", title: "Bastidores da aula" });
    await as(liliUser).mutation(api.ideas.toggleLike, { ideaId: id });
    await as(admin).mutation(api.ideas.toggleLike, { ideaId: id });
    await as(liliUser).mutation(api.ideas.addComment, { ideaId: id, body: "Amei, posso gravar quinta" });
    let [card] = await as(liliUser).query(api.ideas.list, { slug: "lili" });
    expect(card.likes).toMatchObject({ count: 2, mine: true });
    expect(card.likes.names).toContain("Estúdio");
    expect(card.comments[0]).toMatchObject({ body: "Amei, posso gravar quinta", isMine: true });
    expect(card.status).toBe("nova");

    await as(liliUser).mutation(api.ideas.toggleLike, { ideaId: id });
    [card] = await as(liliUser).query(api.ideas.list, { slug: "lili" });
    expect(card.likes).toMatchObject({ count: 1, mine: false });

    await expect(as(biaUser).mutation(api.ideas.toggleLike, { ideaId: id })).rejects.toThrow(/não encontrada/);
    await expect(as(biaUser).mutation(api.ideas.addComment, { ideaId: id, body: "oi" })).rejects.toThrow(/não encontrada/);
    await expect(as(liliUser).mutation(api.ideas.removeComment, { commentId: (await as(admin).query(api.ideas.list, { slug: "lili" }))[0].comments[0]._id })).resolves.toBeNull();
  });

  test("editar o cartão inteiro", async () => {
    const { as, admin } = await setup();
    const id = await as(admin).mutation(api.ideas.create, { slug: "vivi", title: "Antes", link: "https://www.tiktok.com/@a/video/1" });
    await as(admin).mutation(api.ideas.update, { ideaId: id, title: "Depois", description: "Contexto", adaptation: "Versão com agulha", link: "https://youtu.be/dQw4w9WgXcQ" });
    const [card] = await as(admin).query(api.ideas.list, { slug: "vivi" });
    expect(card).toMatchObject({ title: "Depois", description: "Contexto", adaptation: "Versão com agulha", platform: "youtube", previewPending: true });
  });
});

describe("briefing e esteira", () => {
  test("cliente abre briefing, estúdio começa a criação e a peça nasce ligada a ele", async () => {
    const { as, liliUser, biaUser, admin } = await setup();
    const brief = {
      title: "Postura no home office",
      format: "reels" as const,
      platform: "instagram" as const,
      desiredDate: "2026-10-20",
      objective: "Educar",
      body: "Mostrar 3 ajustes simples na cadeira.",
      links: ["https://instagram.com/p/ref", ""],
    };
    await expect(as(liliUser).mutation(api.briefings.create, { slug: "lili", ...brief, links: ["instagram.com"] })).rejects.toThrow(/https/);
    await expect(as(biaUser).mutation(api.briefings.create, { slug: "lili", ...brief })).rejects.toThrow(/não encontrado/);
    const briefingId = await as(liliUser).mutation(api.briefings.create, { slug: "lili", ...brief });

    const [mine] = await as(liliUser).query(api.briefings.list, { slug: "lili" });
    expect(mine).toMatchObject({ status: "novo", canEdit: true, links: ["https://instagram.com/p/ref"] });
    await expect(as(biaUser).query(api.briefings.get, { briefingId })).rejects.toThrow(/não encontrado/);

    // Aparece no calendário, no estúdio e na esteira.
    const cal = await as(liliUser).query(api.calendar.month, { slug: "lili", month: "2026-10" });
    expect(cal.briefings).toEqual([{ _id: briefingId, date: "2026-10-20", title: "Postura no home office" }]);
    const inbox = await as(admin).query(api.dashboard.studioInbox, {});
    expect(inbox.some((i) => i.kind === "briefing" && i.briefingId === briefingId)).toBe(true);
    await expect(as(liliUser).query(api.briefings.pipeline, { month: "2026-10" })).rejects.toThrow(/administradora/);
    let esteira = await as(admin).query(api.briefings.pipeline, { month: "2026-10" });
    expect(esteira.briefings.map((b) => b._id)).toContain(briefingId);

    await expect(as(liliUser).mutation(api.briefings.start, { briefingId, date: "2026-10-20", platform: "instagram", format: "reels" })).rejects.toThrow(/administradora/);
    const contentId = await as(admin).mutation(api.briefings.start, { briefingId, date: "2026-10-21", platform: "instagram", format: "reels" });

    const piece = await as(admin).query(api.contents.get, { contentId });
    expect(piece.content).toMatchObject({ status: "producao", date: "2026-10-21", title: "Postura no home office", objective: "Educar" });
    expect(piece.briefing?.body).toBe("Mostrar 3 ajustes simples na cadeira.");
    // Na aprovação a cliente vê só a versão final, sem o briefing.
    expect((await as(liliUser).query(api.contents.get, { contentId })).briefing).toBeNull();
    const after = await as(liliUser).query(api.briefings.get, { briefingId });
    expect(after).toMatchObject({ status: "em_criacao", canEdit: false, content: { _id: contentId, status: "producao" } });
    await expect(as(liliUser).mutation(api.briefings.update, { briefingId, ...brief })).rejects.toThrow(/com o estúdio/);

    esteira = await as(admin).query(api.briefings.pipeline, { month: "2026-10" });
    expect(esteira.briefings.map((b) => b._id)).not.toContain(briefingId);
    expect(esteira.contents.find((c) => c._id === contentId)).toMatchObject({ fromBriefing: true, client: { slug: "lili" } });

    // Apagar a peça devolve o briefing para a esteira.
    await as(admin).mutation(api.contents.remove, { contentId });
    expect(await as(admin).query(api.briefings.get, { briefingId })).toMatchObject({ status: "novo", content: null });
  });
});

describe("briefing de peça existente", () => {
  test("admin escreve o briefing de uma peça que nasceu sem ele", async () => {
    const { as, liliUser, admin, waiting } = await setup();
    const f = { title: "Peça antiga", body: "Contexto para a equipe.", links: [] };
    await expect(as(liliUser).mutation(api.briefings.attach, { contentId: waiting[0], ...f })).rejects.toThrow(/administradora/);
    const briefingId = await as(admin).mutation(api.briefings.attach, { contentId: waiting[0], ...f });
    const piece = await as(admin).query(api.contents.get, { contentId: waiting[0] });
    expect(piece.briefing?._id).toBe(briefingId);
    await expect(as(admin).mutation(api.briefings.attach, { contentId: waiting[0], ...f })).rejects.toThrow(/já tem briefing/);
    const esteira = await as(admin).query(api.briefings.pipeline, { month: "2026-10" });
    expect(esteira.briefings.map((b) => b._id)).not.toContain(briefingId);
  });
});

describe("página inicial do estúdio", () => {
  test("atrasados, semana e perfil", async () => {
    const { as, admin, liliUser } = await setup();
    await expect(as(liliUser).query(api.dashboard.studioHome, { today: "2026-10-15" })).rejects.toThrow(/administradora/);
    const home = await as(admin).query(api.dashboard.studioHome, { today: "2026-10-15" });
    expect(home.me.name).toBe("Sarah");
    expect(home.counts.late).toBe(home.late.length);
    expect(home.late.every((c) => c.date < "2026-10-15" && c.status !== "publicado" && c.daysLate > 0)).toBe(true);
    expect(home.week.every((c) => c.date >= "2026-10-15" && c.date <= "2026-10-21")).toBe(true);
    await as(admin).mutation(api.dashboard.updateProfile, { name: "Sarah de Paula" });
    expect((await as(admin).query(api.dashboard.studioHome, { today: "2026-10-15" })).me.name).toBe("Sarah de Paula");
    await expect(as(admin).mutation(api.dashboard.updateProfile, { name: "  " })).rejects.toThrow(/nome/);
  });
});


describe("lixeira", () => {
  test("peça vai para a lixeira, some das telas, volta ao restaurar e some de vez após 15 dias", async () => {
    const { t, as, admin, liliUser, waiting } = await setup();
    const id = waiting[0];
    await expect(as(liliUser).mutation(api.contents.trash, { contentId: id })).rejects.toThrow(/administradora/);
    await as(admin).mutation(api.contents.trash, { contentId: id });

    const cal = await as(admin).query(api.calendar.month, { slug: "lili", month: "2026-10" });
    expect(cal.contents.some((c) => c._id === id)).toBe(false);
    await expect(as(liliUser).query(api.contents.get, { contentId: id })).rejects.toThrow(/não encontrado/);
    const bin = await as(admin).query(api.contents.trashList, {});
    expect(bin).toHaveLength(1);
    expect(bin[0]).toMatchObject({ _id: id, daysLeft: 15, client: { slug: "lili" } });

    await as(admin).mutation(api.contents.restore, { contentId: id });
    expect((await as(admin).query(api.calendar.month, { slug: "lili", month: "2026-10" })).contents.some((c) => c._id === id)).toBe(true);

    await as(admin).mutation(api.contents.trash, { contentId: id });
    expect(await t.mutation(internal.contents.purgeExpired, {})).toBe(0); // ainda dentro dos 15 dias
    await t.run((ctx) => ctx.db.patch(id, { deletedAt: Date.now() - 16 * 86_400_000 }));
    expect(await t.mutation(internal.contents.purgeExpired, {})).toBe(1);
    expect(await t.run((ctx) => ctx.db.get(id))).toBeNull();
  });

  test("peça da fila apagada de vez não volta no próximo deploy", async () => {
    const { t, as, admin } = await setup();
    const items = JSON.parse(await (await import("node:fs/promises")).readFile("conteudo/vivi-2026-10.json", "utf8"));
    await t.mutation(internal.imports.apply, { items });
    const month = await as(admin).query(api.calendar.month, { slug: "vivi", month: "2026-10" });
    const first = month.contents.find((c) => c.date === "2026-10-05")!;
    await as(admin).mutation(api.contents.trash, { contentId: first._id });
    expect(await t.mutation(internal.imports.apply, { items: [items[0]] })).toContain("vivi-2026-10-o-que-e-dor: está na lixeira, não mexi");
    await as(admin).mutation(api.contents.remove, { contentId: first._id });
    expect(await t.mutation(internal.imports.apply, { items: [items[0]] })).toContain("vivi-2026-10-o-que-e-dor: apagada pela admin, não recriei");
  });
});

describe("chave fixa da admin", () => {
  test("chave errada não entra", async () => {
    const { t } = await setup();
    expect(await t.mutation(internal.access.userForToken, { token: "x".repeat(40) })).toBeNull();
  });
});

describe("convite por e-mail", () => {
  test("sem Gmail configurado, registra o motivo em vez de quebrar", async () => {
    const { t, as, admin, liliUser } = await setup();
    await expect(as(liliUser).query(api.invites.mailStatus, {})).rejects.toThrow(/administradora/);
    expect((await as(admin).query(api.invites.mailStatus, {})).ready).toBe(false);
    const inviteId = await as(admin).mutation(api.invites.create, { email: "nova@cliente.com", name: "Nova", role: "cliente", clientSlug: "lili", sendEmail: true });
    expect(await t.run((ctx) => ctx.db.get(inviteId))).toMatchObject({ emailPending: true });
    await t.finishAllScheduledFunctions(() => {});
    const after = await t.run((ctx) => ctx.db.get(inviteId));
    expect(after).toMatchObject({ emailPending: false });
    expect(after?.emailError).toMatch(/não configurado/);
  });
});
