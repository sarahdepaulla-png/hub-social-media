/** Cores e helpers visuais do Plano do mês. */

export const PHASE_COLORS = ["#C2577A", "#8A6A2E", "#5C0F31", "#2B6CB0", "#8A63D2", "#B8321C"];
export const HIGHLIGHT_COLOR = "#0F7A6E";
const DEFAULT_TONES = ["#F2D4DE", "#5C0F31", "#EBC6D3", "#FFFFFF"];

/** Texto legível sobre a cor (claro ou escuro). */
export function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#2B1E1A" : "#FFFFFF";
}

/** Fundo do rascunho de capa: gira pela paleta do mês. */
export function sketchTone(palette: string[], index: number) {
  const tones = palette.length ? palette : DEFAULT_TONES;
  const bg = tones[index % tones.length];
  return { bg, fg: inkOn(bg) };
}

export function dayNum(iso: string) {
  return Number(iso.slice(8, 10));
}

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
/** "Qua 11/11" */
export function dayLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${WD[d.getUTCDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "11 a 15/11" */
export function rangeLabel(start: string, end: string) {
  const s = start.slice(8, 10);
  const e = `${end.slice(8, 10)}/${end.slice(5, 7)}`;
  return start.slice(5, 7) === end.slice(5, 7) ? `${Number(s)} a ${e}` : `${s}/${start.slice(5, 7)} a ${e}`;
}
