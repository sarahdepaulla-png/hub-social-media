"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { createContext, useContext, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Avatar, Loading, Logo } from "./brand";
import { SignOutButton } from "./SignOutButton";

type Workspace = FunctionReturnType<typeof api.clients.bySlug>;
const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspace(): Workspace {
  const ws = useContext(WorkspaceContext);
  if (!ws) throw new Error("useWorkspace fora do workspace");
  return ws;
}

const ICONS = {
  inicio: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  calendario: (
    <>
      <rect x="3.5" y="5" width="17" height="15" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  datas: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />,
  ideias: <path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9V16h7v-2.1A6 6 0 0012 3z" />,
};

export function WorkspaceShell({ slug, children }: { slug: string; children: ReactNode }) {
  const ws = useQuery(api.clients.bySlug, { slug });
  const pathname = usePathname();

  if (ws === undefined) return <Loading />;

  const base = `/w/${slug}`;
  // Na peça, a barra de decisão ocupa a base da tela no lugar da navegação.
  const focused = pathname.startsWith(`${base}/c/`);
  const tabs: { href: string; label: string; icon: React.ReactNode; active: boolean; badge?: number }[] = [
    { href: base, label: "Início", icon: ICONS.inicio, active: pathname === base },
    { href: `${base}/calendario`, label: "Calendário", icon: ICONS.calendario, active: pathname.startsWith(`${base}/calendario`) || pathname.startsWith(`${base}/c/`) },
    { href: `${base}/datas`, label: "Datas", icon: ICONS.datas, active: pathname.startsWith(`${base}/datas`) },
    { href: `${base}/ideias`, label: "Ideias", icon: ICONS.ideias, active: pathname.startsWith(`${base}/ideias`), badge: ws.newIdeas },
  ];

  return (
    <WorkspaceContext.Provider value={ws}>
      <div className={`flex min-h-dvh flex-col md:pb-0 ${focused ? "" : "pb-[76px]"}`}>
        <div className="h-1 shrink-0" style={{ background: ws.accentColor }} />
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4">
            {ws.viewerRole === "admin" ? (
              <Link href="/estudio" className="text-sm font-semibold text-rosa-forte hover:text-rosa-forte-hover">
                Estúdio
              </Link>
            ) : (
              <Logo className="hidden sm:inline-flex" />
            )}
          </div>
          <nav aria-label="Workspace" className="hidden items-center gap-7 text-[15px] md:flex">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={t.active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 ${t.active ? "font-bold shadow-[inset_0_-2px_0_var(--color-vinho)]" : "text-texto-3 hover:text-vinho"}`}
              >
                {t.label}
                {!!t.badge && (
                  <span className="rounded-full bg-rosa-forte px-1.5 text-xs font-bold leading-5 text-white" aria-label={`${t.badge} novas`}>
                    {t.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold">{ws.name}</span>
            <Avatar name={ws.name} color={ws.accentColor} url={ws.photoUrl} />
            <span className="hidden md:inline">
              <SignOutButton variant="link" />
            </span>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <nav
          aria-label="Navegação principal"
          hidden={focused}
          className="fixed inset-x-0 bottom-0 z-20 grid h-[76px] grid-cols-4 border-t border-linha bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 text-xs ${t.active ? "font-bold text-vinho" : "text-texto-2"}`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                {t.icon}
              </svg>
              {!!t.badge && (
                <span className="absolute left-1/2 top-2.5 ml-2 min-w-5 rounded-full bg-rosa-forte px-1 text-center text-[11px] font-bold leading-5 text-white" aria-label={`${t.badge} novas`}>
                  {t.badge}
                </span>
              )}
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </WorkspaceContext.Provider>
  );
}
