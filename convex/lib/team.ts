/** Equipe do estúdio. Nomes novos digitados na tela entram na lista sozinhos. */
export const TEAM = ["Sarita", "Mai", "Leo"];

export function cleanOwner(owner?: string) {
  const o = owner?.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!o) return undefined;
  const known = TEAM.find((t) => t.toLowerCase() === o.toLowerCase());
  return known ?? o.charAt(0).toUpperCase() + o.slice(1);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function cleanDue(due?: string) {
  const d = due?.trim();
  if (!d) return undefined;
  if (!DATE.test(d)) throw new Error("Prazo inválido.");
  return d;
}
