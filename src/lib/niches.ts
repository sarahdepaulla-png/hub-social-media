/** Nichos usados para cruzar clientes com a biblioteca de datas. */
export const DEFAULT_NICHES = ["fisioterapia", "ensino", "acupuntura", "clinica", "musica", "beleza"];

export function parseNiches(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(",")
        .map((n) =>
          n
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, ""),
        )
        .filter(Boolean),
    ),
  );
}
