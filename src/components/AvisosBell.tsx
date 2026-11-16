"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

/** Sininho dos Avisos (só a admin vê): quantas ações das clientes ainda não foram lidas. */
export function AvisosBell({ className = "" }: { className?: string }) {
  const unread = useQuery(api.presence.unread);
  if (unread === undefined || unread === null) return null;
  return (
    <Link
      href="/estudio/avisos"
      aria-label={unread ? `Avisos, ${unread} novos` : "Avisos"}
      className={`relative flex size-11 items-center justify-center rounded-full hover:bg-creme ${className}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute right-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-rosa-forte px-1 text-[11px] font-bold leading-5 text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
