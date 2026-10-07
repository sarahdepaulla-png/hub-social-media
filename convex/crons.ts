import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Lixeira: o que passou 15 dias lá é apagado de vez.
crons.daily("esvaziar lixeira", { hourUTC: 6, minuteUTC: 0 }, internal.contents.purgeExpired, {});

// Instagram: métricas novas de hora em hora (stories somem em 24h).
crons.hourly("métricas do instagram", { minuteUTC: 17 }, internal.instagram.syncAll, {});

export default crons;
