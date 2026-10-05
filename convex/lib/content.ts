import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export type Status = Doc<"contents">["status"];

/** Quanto tempo a pessoa tem para desfazer a própria decisão. */
export const UNDO_WINDOW_MS = 10 * 60 * 1000;

/** Aprovado e ainda não postado (aprovado ou agendado). Postado conta à parte. */
export const APPROVED_GROUP: Status[] = ["aprovado", "agendado"];

export function monthRange(month: string) {
  // month = "AAAA-MM"
  return { start: `${month}-01`, end: `${month}-31` };
}

/** Quanto tempo uma peça fica na lixeira antes de sumir de vez. */
export const TRASH_DAYS = 15;
export const TRASH_MS = TRASH_DAYS * 24 * 60 * 60 * 1000;

/** Fora da lixeira. */
export const alive = (c: Doc<"contents">) => !c.deletedAt;

export async function contentsInMonth(ctx: QueryCtx, clientId: Doc<"clients">["_id"], month: string) {
  const { start, end } = monthRange(month);
  return (
    await ctx.db
      .query("contents")
      .withIndex("by_client_date", (q) => q.eq("clientId", clientId).gte("date", start).lte("date", end))
      .collect()
  ).filter(alive);
}

export function countByStatus(list: Doc<"contents">[]) {
  const c = { total: list.length, publicados: 0, aprovados: 0, aguardando: 0, ajuste: 0, producao: 0, ideia: 0 };
  for (const item of list) {
    if (item.status === "publicado") c.publicados++;
    else if (APPROVED_GROUP.includes(item.status)) c.aprovados++;
    else if (item.status === "aguardando") c.aguardando++;
    else if (item.status === "ajuste") c.ajuste++;
    else if (item.status === "producao") c.producao++;
    else if (item.status === "ideia") c.ideia++;
  }
  return c;
}

/** Forma enxuta enviada para a tela, com a URL da capa já resolvida. */
export async function toCard(ctx: QueryCtx, item: Doc<"contents">) {
  const coverUrl = item.coverId ? await ctx.storage.getUrl(item.coverId) : (item.coverUrl ?? null);
  return {
    _id: item._id,
    date: item.date,
    time: item.time ?? null,
    title: item.title,
    platform: item.platform,
    format: item.format,
    status: item.status,
    version: item.version,
    coverUrl,
  };
}
