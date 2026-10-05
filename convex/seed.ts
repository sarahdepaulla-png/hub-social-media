import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/**
 * Dados iniciais: 4 clientes, datas do nicho e um mês de exemplo da Lili.
 * Roda sozinho no deploy da Vercel. Local: npx convex run seed:run
 * Opcional: npx convex run seed:run '{"month":"2026-10"}'
 */

const CLIENTS = [
  { slug: "lili", name: "Lili", description: "Professora de fisioterapia", niches: ["fisioterapia", "ensino"], accentColor: "#2F8F9D" },
  { slug: "vivi", name: "Vivi", description: "Fisioterapeuta, professora, acupuntura e clínica", niches: ["fisioterapia", "acupuntura", "ensino", "clinica"], accentColor: "#5E7F3E" },
  { slug: "entalpia", name: "Entalpia", description: "Projeto musical", niches: ["musica"], accentColor: "#C8481E" },
  { slug: "bia", name: "Bia", description: "Maquiagem e beleza", niches: ["beleza"], accentColor: "#B8457A" },
];

// Datas recorrentes (MM-DD). allMonth = vale o mês inteiro.
const OPPORTUNITIES: { md: string; title: string; hint?: string; niches: string[]; allMonth?: boolean }[] = [
  { md: "10-01", title: "Outubro Rosa", hint: "Fisioterapia na reabilitação pós-mastectomia", niches: ["fisioterapia", "clinica"], allMonth: true },
  { md: "10-01", title: "Dia Internacional da Música", niches: ["musica"] },
  { md: "10-13", title: "Dia do Fisioterapeuta e do Terapeuta Ocupacional", niches: ["fisioterapia"] },
  { md: "10-15", title: "Dia do Professor", hint: "Mostrar o lado docente", niches: ["ensino"] },
  { md: "10-16", title: "Dia Mundial da Coluna", hint: "Postura e dor lombar", niches: ["fisioterapia"] },
  { md: "10-24", title: "Dia Mundial de Combate à Poliomielite", niches: ["fisioterapia"] },
  { md: "10-31", title: "Halloween", hint: "Makes temáticas", niches: ["beleza", "musica"] },
  { md: "11-01", title: "Novembro Azul", hint: "Saúde do homem", niches: ["fisioterapia", "clinica"], allMonth: true },
  { md: "11-22", title: "Dia do Músico", niches: ["musica"] },
  { md: "11-27", title: "Black Friday", niches: ["beleza", "clinica"] },
  { md: "12-01", title: "Planejamento de fim de ano", hint: "Retrospectiva e metas", niches: ["fisioterapia", "ensino", "musica", "beleza", "clinica", "acupuntura"], allMonth: true },
];

type Seed = Pick<Doc<"contents">, "platform" | "format" | "title" | "status" | "objective" | "pillar"> & { day: number };

const LILI: Seed[] = [
  { day: 2, title: "Mito: estalar o joelho faz mal?", platform: "instagram", format: "reels", status: "publicado", pillar: "Mitos e verdades" },
  { day: 6, title: "3 exercícios para a lombar", platform: "instagram", format: "carrossel", status: "publicado", pillar: "Educação prática" },
  { day: 8, title: "Bastidor da aula prática", platform: "instagram", format: "stories", status: "agendado", pillar: "Bastidores" },
  { day: 13, title: "Dia do Fisioterapeuta", platform: "instagram", format: "reels", status: "aguardando", pillar: "Autoridade", objective: "Alcance" },
  { day: 15, title: "5 erros no alongamento de posteriores", platform: "instagram", format: "carrossel", status: "aguardando", pillar: "Educação prática", objective: "Salvamentos e autoridade" },
  { day: 17, title: "Respiração diafragmática", platform: "instagram", format: "reels", status: "aprovado", pillar: "Educação prática" },
  { day: 20, title: "Joelho valgo: o que é", platform: "instagram", format: "imagem", status: "aguardando", pillar: "Mitos e verdades" },
  { day: 22, title: "Rotina para quem trabalha sentado", platform: "instagram", format: "carrossel", status: "ajuste", pillar: "Educação prática", objective: "Salvamentos" },
  { day: 24, title: "Caixa de perguntas", platform: "instagram", format: "stories", status: "aprovado", pillar: "Relacionamento" },
  { day: 27, title: "Ombro congelado", platform: "instagram", format: "carrossel", status: "producao", pillar: "Educação prática" },
  { day: 29, title: "Postura no celular", platform: "tiktok", format: "reels", status: "aguardando", pillar: "Educação prática" },
  { day: 31, title: "Resumo do mês", platform: "instagram", format: "carrossel", status: "producao", pillar: "Relacionamento" },
];

const BIA: Seed[] = [
  { day: 3, title: "Pele glow em 3 passos", platform: "instagram", format: "reels", status: "publicado", pillar: "Tutorial" },
  { day: 10, title: "Delineado gráfico", platform: "instagram", format: "carrossel", status: "aguardando", pillar: "Tutorial" },
  { day: 18, title: "Base para pele oleosa", platform: "tiktok", format: "reels", status: "aguardando", pillar: "Produtos" },
  { day: 31, title: "Make de Halloween", platform: "instagram", format: "reels", status: "producao", pillar: "Datas" },
];

export const run = internalMutation({
  args: { month: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const month = args.month ?? new Date().toISOString().slice(0, 7);
    const year = month.slice(0, 4);

    // Exemplo do mês só na primeira vez; depois o seed só garante clientes e datas.
    const firstRun = (await ctx.db.query("clients").first()) === null;
    const ids: Record<string, Doc<"clients">["_id"]> = {};
    for (const c of CLIENTS) {
      const existing = await ctx.db
        .query("clients")
        .withIndex("by_slug", (q) => q.eq("slug", c.slug))
        .unique();
      ids[c.slug] = existing?._id ?? (await ctx.db.insert("clients", { ...c, active: true }));
    }

    if ((await ctx.db.query("opportunities").first()) === null) {
      for (const o of OPPORTUNITIES) {
        await ctx.db.insert("opportunities", {
          date: `${year}-${o.md}`,
          title: o.title,
          hint: o.hint,
          niches: o.niches,
          allMonth: o.allMonth,
        });
      }
    }

    const fill = async (slug: string, items: Seed[]) => {
      const clientId = ids[slug];
      const already = await ctx.db
        .query("contents")
        .withIndex("by_client_date", (q) => q.eq("clientId", clientId).gte("date", `${month}-01`).lte("date", `${month}-31`))
        .first();
      if (already) return;
      for (const { day, ...rest } of items) {
        const contentId = await ctx.db.insert("contents", {
          clientId,
          date: `${month}-${String(day).padStart(2, "0")}`,
          version: 1,
          ...rest,
        });
        if (rest.status === "aguardando") {
          await ctx.db.insert("captions", { contentId, order: 1, text: "Opção curta e direta para teste.", cta: "Salva para depois" });
          await ctx.db.insert("captions", { contentId, order: 2, text: "Opção com mais contexto, contando por que esse tema importa no dia a dia.", cta: "Manda para quem precisa" });
        }
      }
    };
    if (firstRun) {
      await fill("lili", LILI);
      await fill("bia", BIA);
    }

    return firstRun ? `Clientes e mês de exemplo criados (${month})` : "Dados iniciais já existiam";
  },
});
