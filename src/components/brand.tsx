import type { CSSProperties, ReactNode } from "react";
import { STATUS, type Status } from "@/lib/labels";

/** Asterisco de 8 pontas: a marca do Hub. */
export function Asterisk({ size = 40, color = "currentColor", spinning = false, className = "" }: {
  size?: number;
  color?: string;
  spinning?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      style={spinning ? { animation: "asterisco-gira 2.4s linear infinite" } : undefined}
    >
      <g fill={color}>
        {[0, 45, 90, 135].map((r) => (
          <rect key={r} x="41" y="0" width="18" height="100" rx="5" transform={`rotate(${r} 50 50)`} />
        ))}
      </g>
    </svg>
  );
}

export function Logo({ className = "text-[19px]" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-black tracking-[-0.05em] ${className}`}>
      Hub <Asterisk size={14} color="var(--color-rosa-forte)" /> Social Media
    </span>
  );
}

const STAR =
  "50,0 59.1,10 71.7,5 75.6,17.9 89.1,18.8 86.9,32.2 98.7,38.9 91,50 98.7,61.1 86.9,67.8 89.1,81.2 75.6,82.1 71.7,95 59.1,90 50,100 40.9,90 28.3,95 24.4,82.1 10.9,81.2 13.1,67.8 1.3,61.1 9,50 1.3,38.9 13.1,32.2 10.9,18.8 24.4,17.9 28.3,5 40.9,10";

/** Adesivo estrela. Aprovar = colar este adesivo na peça. */
export function Sticker({ children = "aprovado", size = 96, fill = "var(--color-rosa)", animate = false, className = "", style }: {
  children?: ReactNode;
  size?: number;
  fill?: string;
  animate?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        transform: "rotate(-12deg)",
        animation: animate ? "adesivo-pop 300ms ease-out both" : undefined,
        ...style,
      }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className="absolute inset-0" aria-hidden="true">
        <polygon points={STAR} fill={fill} stroke="var(--color-vinho)" strokeWidth="2" />
      </svg>
      <span className="relative font-black tracking-[-0.03em] text-vinho" style={{ fontSize: size * 0.15 }}>
        {children}
      </span>
    </span>
  );
}

/** Caixa com alças de seleção (estilo Figma). Um destaque por tela. */
export function SelectionBox({ children, tone = "vinho", tilt = true, className = "" }: {
  children: ReactNode;
  tone?: "vinho" | "rosa" | "ajuste";
  tilt?: boolean;
  className?: string;
}) {
  const styles = {
    vinho: { box: "bg-vinho text-white", handle: "bg-white border-vinho" },
    rosa: { box: "bg-rosa text-vinho border-[1.5px] border-vinho", handle: "bg-vinho border-vinho" },
    ajuste: { box: "border-2 border-st-ajuste", handle: "bg-st-ajuste border-st-ajuste" },
  }[tone];
  const h = `absolute size-2 border-[1.5px] ${styles.handle}`;
  return (
    <span className={`relative inline-block ${styles.box} ${tilt ? "-rotate-[1.5deg]" : ""} ${className}`}>
      <span aria-hidden="true" className={`${h} -left-1 -top-1`} />
      <span aria-hidden="true" className={`${h} -right-1 -top-1`} />
      <span aria-hidden="true" className={`${h} -bottom-1 -left-1`} />
      <span aria-hidden="true" className={`${h} -bottom-1 -right-1`} />
      {children}
    </span>
  );
}

/** Ponto + palavra. Nunca só cor. */
export function StatusTag({ status, short = false, className = "" }: { status: Status; short?: boolean; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${className}`}>
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={status === "ideia" ? { border: `2px solid ${s.color}` } : { background: s.color }}
      />
      {short ? s.short : s.label}
    </span>
  );
}

export function Avatar({ name, color, url, size = 36 }: { name: string; color: string; url?: string | null; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-thumb font-bold text-vinho"
      style={{ width: size, height: size, border: `2.5px solid ${color}`, fontSize: size * 0.4 }}
    >
      {url ? <img src={url} alt="" draggable={false} className="size-full object-cover" /> : name.charAt(0)}
    </span>
  );
}

export const buttonClass = {
  primary:
    "inline-flex min-h-12 items-center justify-center rounded-full bg-vinho px-6 text-base font-bold text-white transition-colors hover:bg-vinho-escuro disabled:opacity-50",
  secondary:
    "inline-flex min-h-12 items-center justify-center rounded-full bg-rosa px-6 text-base font-bold text-vinho transition-colors hover:bg-rosa-grade disabled:opacity-50",
  outline:
    "inline-flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-vinho px-6 text-base font-semibold text-vinho transition-colors hover:bg-white disabled:opacity-50",
  danger:
    "inline-flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-st-ajuste px-6 text-base font-semibold text-st-ajuste-texto transition-colors hover:bg-white disabled:opacity-50",
};

/** Thumbnail da peça. Sem capa ainda: placeholder com o formato. */
export function Thumb({ url, label, className = "", tone = 0 }: { url?: string | null; label?: string; className?: string; tone?: number }) {
  const bg = ["bg-thumb", "bg-thumb-2", "bg-thumb-3"][tone % 3];
  return (
    <span className={`relative block overflow-hidden rounded-peca ${bg} ${className}`}>
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : label ? (
        <span className="absolute bottom-2.5 left-2.5 rounded-md bg-white px-2 py-0.5 text-xs text-vinho">{label}</span>
      ) : null}
    </span>
  );
}

export function Loading({ label = "Carregando" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-texto-2">
      <Asterisk size={36} color="var(--color-rosa)" spinning />
      <span className="text-sm">{label}</span>
    </div>
  );
}
