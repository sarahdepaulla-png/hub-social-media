/** Datas sempre no fuso do estúdio (São Paulo), em texto AAAA-MM-DD. */

const TZ = "America/Sao_Paulo";

export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function currentMonth(now = new Date()): string {
  return todayISO(now).slice(0, 7);
}

function parse(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  // Meio-dia UTC evita virar o dia por causa de fuso.
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12));
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function monthName(month: string): string {
  return cap(new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(parse(`${month}-01`)));
}

/** "Qui, 15 out" */
export function shortDate(iso: string): string {
  const d = parse(iso);
  const wd = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(d).replace(".", "");
  const mo = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(d).replace(".", "");
  return `${cap(wd)}, ${d.getUTCDate()} ${mo}`;
}

/** "quinta, 15 de outubro" */
export function longDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(parse(iso));
}

export function isToday(iso: string) {
  return iso === todayISO();
}

/** "hoje, 10:57", "ontem, 18:42" ou "5 out, 09:10" */
export function stamp(ms: number): string {
  const d = new Date(ms);
  const day = todayISO(d);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
  const today = todayISO();
  const yesterday = todayISO(new Date(Date.now() - 86_400_000));
  if (day === today) return `hoje, ${time}`;
  if (day === yesterday) return `ontem, ${time}`;
  const dm = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "numeric", month: "short" }).format(d).replace(".", "").replace(" de ", " ");
  return `${dm}, ${time}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Células do mês começando no domingo. null = dia de outro mês. */
export function monthGrid(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function addDays(iso: string, n: number): string {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
