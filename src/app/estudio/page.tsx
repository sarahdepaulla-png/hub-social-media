"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Loading } from "@/components/brand";
import { AutoCovers } from "@/components/AutoCovers";
import { StudioHome, useClock } from "@/components/studio/StudioHome";

/** Página inicial da admin. */
export default function EstudioPage() {
  const { greeting, time, today } = useClock();
  const home = useQuery(api.dashboard.studioHome, { today });
  const clients = useQuery(api.clients.listForStudio, { month: today.slice(0, 7), today });
  const inbox = useQuery(api.dashboard.studioInbox, {});

  return (
    <>
      <AutoCovers />
      {home === undefined || clients === undefined || inbox === undefined ? (
        <Loading />
      ) : (
        <StudioHome home={home} clients={clients} inbox={inbox} greeting={greeting} time={time} today={today} />
      )}
    </>
  );
}
