import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Lixeira: o que passou 15 dias lá é apagado de vez.
crons.daily("esvaziar lixeira", { hourUTC: 6, minuteUTC: 0 }, internal.contents.purgeExpired, {});

export default crons;
