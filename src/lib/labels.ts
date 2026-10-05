export type Status = "ideia" | "producao" | "aguardando" | "ajuste" | "aprovado" | "agendado" | "publicado";
export type Platform = "instagram" | "tiktok" | "youtube" | "linkedin" | "outra";
export type Format = "imagem" | "carrossel" | "reels" | "stories" | "video" | "link";

export const STATUS: Record<Status, { label: string; short: string; color: string }> = {
  ideia: { label: "Ideia", short: "Ideia", color: "var(--color-st-ideia)" },
  producao: { label: "Em produção", short: "Produção", color: "var(--color-st-producao)" },
  aguardando: { label: "Aguardando aprovação", short: "Aguardando", color: "var(--color-st-aguardando)" },
  ajuste: { label: "Ajuste solicitado", short: "Ajuste", color: "var(--color-st-ajuste)" },
  aprovado: { label: "Aprovado", short: "Aprovado", color: "var(--color-st-aprovado)" },
  agendado: { label: "Agendado", short: "Agendado", color: "var(--color-st-agendado)" },
  publicado: { label: "Publicado", short: "Publicado", color: "var(--color-st-publicado)" },
};

export const PLATFORM: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  outra: "Outra",
};

export const FORMAT: Record<Format, string> = {
  imagem: "Imagem",
  carrossel: "Carrossel",
  reels: "Reels",
  stories: "Stories",
  video: "Vídeo",
  link: "Link externo",
};
