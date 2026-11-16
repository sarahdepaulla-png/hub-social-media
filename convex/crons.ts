import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Lixeira: o que passou 15 dias lá é apagado de vez.
crons.daily("esvaziar lixeira", { hourUTC: 6, minuteUTC: 0 }, internal.contents.purgeExpired, {});

// Cópia de segurança de tudo, todo dia de madrugada (3h no horário de Brasília).
crons.daily("backup diario", { hourUTC: 6, minuteUTC: 20 }, internal.revisions.runBackup, {});

// Instagram: métricas novas de hora em hora (stories somem em 24h).

export default crons;
