"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Avatar, Loading } from "@/components/brand";

/** Escolha da cliente: cada uma tem o seu painel no estúdio. */
export default function PanelIndex() {
  const clients = useQuery(api.clients.listAdmin, {});
  if (clients === undefined) return <Loading />;
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-20 pt-6 md:px-6">
      <h1 className="titulo text-5xl md:text-6xl">Painel das clientes</h1>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {clients.map((c) => (
          <li key={c._id}>
            <Link href={`/estudio/c/${c.slug}`} className="flex flex-col items-center gap-3 rounded-[22px] bg-white p-6 text-center hover:bg-[#FFF6FA]">
              <Avatar name={c.name} color={c.accentColor} url={c.photoUrl} size={76} />
              <strong className="text-lg">{c.name}</strong>
              {!c.active && <span className="text-[13px] text-texto-2">pausado</span>}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
