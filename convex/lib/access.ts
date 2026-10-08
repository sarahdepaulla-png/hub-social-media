import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Toda leitura e escrita passa por aqui. A regra:
 * admin acessa tudo; cliente só o próprio workspace.
 */

export async function getViewer(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return await ctx.db.get(userId);
}

export async function requireViewer(ctx: QueryCtx): Promise<Doc<"users">> {
  const viewer = await getViewer(ctx);
  if (!viewer || !viewer.role) {
    throw new ConvexError("Sem acesso. Entre novamente.");
  }
  return viewer;
}

export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const viewer = await requireViewer(ctx);
  if (viewer.role !== "admin") throw new ConvexError("Só a administradora pode fazer isso.");
  return viewer;
}

export function canAccessClient(viewer: Doc<"users">, clientId: Id<"clients">): boolean {
  return viewer.role === "admin" || viewer.clientId === clientId;
}

export async function requireClientAccess(ctx: QueryCtx, clientId: Id<"clients">) {
  const viewer = await requireViewer(ctx);
  if (!canAccessClient(viewer, clientId)) throw new ConvexError("Este workspace não é seu.");
  return viewer;
}

/** Carrega a peça e confere se quem pede pode vê-la. */
export async function requireContentAccess(ctx: QueryCtx, contentId: Id<"contents">) {
  const viewer = await requireViewer(ctx);
  const content = await ctx.db.get(contentId);
  // Peça na lixeira só a admin enxerga (para restaurar).
  if (!content || !canAccessClient(viewer, content.clientId) || (content.deletedAt && viewer.role !== "admin")) {
    throw new ConvexError("Conteúdo não encontrado.");
  }
  const client = (await ctx.db.get(content.clientId))!;
  return { viewer, content, client };
}

/** A pessoa pode editar esta peça? Admin sempre; cliente só com a edição liberada. */
export function canEditContent(viewer: Doc<"users">, client: Doc<"clients">) {
  return viewer.role === "admin" || (viewer.clientId === client._id && client.clientCanEdit === true);
}

/** Para mutações do editor: admin, ou equipe da cliente com edição liberada. */
export async function requireContentEditor(ctx: QueryCtx, contentId: Id<"contents">) {
  const { viewer, content, client } = await requireContentAccess(ctx, contentId);
  if (!canEditContent(viewer, client)) throw new ConvexError("Só a administradora pode fazer isso.");
  if (content.deletedAt) throw new ConvexError("Esta peça está na lixeira.");
  return { viewer, content, client };
}

/** Resolve o slug da URL e já confere o acesso. */
export async function requireClientBySlug(ctx: QueryCtx, slug: string) {
  const viewer = await requireViewer(ctx);
  // first() e não unique(): um endereço repetido por engano não pode derrubar a página.
  const client = await ctx.db
    .query("clients")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (!client || !canAccessClient(viewer, client._id)) {
    // Mesmo erro para "não existe" e "não é seu": não revela outros clientes.
    throw new ConvexError("Workspace não encontrado.");
  }
  return { viewer, client };
}
