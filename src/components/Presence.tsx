"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "@convex/_generated/api";

/** Sinal de vida: a cada minuto com o Hub aberto e visível. Alimenta "online agora" e "entrou no Hub". */
export function Presence() {
  const { isAuthenticated } = useConvexAuth();
  const ping = useMutation(api.presence.ping);
  useEffect(() => {
    if (!isAuthenticated) return;
    const beat = () => {
      if (document.visibilityState === "visible") void ping({}).catch(() => {});
    };
    beat();
    const id = setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [isAuthenticated, ping]);
  return null;
}
