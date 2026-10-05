"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/estudio", label: "Visão geral" },
  { href: "/estudio/esteira", label: "Esteira" },
  { href: "/estudio/clientes", label: "Clientes e acessos" },
  { href: "/estudio/datas", label: "Biblioteca de datas" },
];

export function StudioNav() {
  const path = usePathname();
  return (
    <nav aria-label="Estúdio" className="flex gap-6 overflow-x-auto text-[15px]">
      {LINKS.map((l) => {
        const active = l.href === "/estudio" ? path === l.href : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`min-h-11 shrink-0 content-center ${active ? "font-bold shadow-[inset_0_-2px_0_var(--color-vinho)]" : "text-texto-3 hover:text-vinho"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
