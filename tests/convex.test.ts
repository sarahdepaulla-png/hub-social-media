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
    expect(d.counts).toMatchObject({ total: 12, aprovados: 5, aguardando: 4, ajuste: 1, producao: 2 });
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
