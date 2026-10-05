/**
 * Build da Vercel. Faz sozinho o que antes pedia terminal:
 * 1. publica o backend no Convex e gera o site (npx convex deploy)
 * 2. cria as chaves de login na primeira vez
 * 3. aponta o login para o endereço do site
 * 4. define quem é admin (variável ADMIN_EMAILS da Vercel)
 * 5. cria os clientes iniciais na primeira vez
 * Configurado em vercel.json. Não roda no seu computador.
 */
import { spawnSync } from "node:child_process";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const log = (msg) => console.log(`\n[hub] ${msg}`);

function convex(args, { quiet = false, input } = {}) {
  const res = spawnSync("npx", ["convex", ...args], {
    encoding: "utf8",
    input,
    stdio: quiet || input !== undefined ? ["pipe", "pipe", "pipe"] : "inherit",
    env: process.env,
  });
  return { ok: res.status === 0, out: (res.stdout ?? "").trim(), err: (res.stderr ?? "").trim() };
}

function getEnv(name) {
  const r = convex(["env", "get", name], { quiet: true });
  return r.ok ? r.out : "";
}

function setEnv(name, value) {
  // Valor pelo stdin: não aparece no log nem na lista de processos.
  const r = convex(["env", "set", name], { input: value });
  if (!r.ok) {
    console.error(`[hub] Não consegui definir ${name} no Convex: ${r.err || r.out}`);
    console.error("[hub] Defina manualmente no painel do Convex > Settings > Environment Variables.");
  }
  return r.ok;
}

if (!process.env.CONVEX_DEPLOY_KEY) {
  console.error(
    "\n[hub] Falta a variável CONVEX_DEPLOY_KEY na Vercel.\n" +
      "[hub] Conecte o Convex pela aba Integrations do projeto na Vercel, ou crie uma Production Deploy Key\n" +
      "[hub] no painel do Convex (Settings > Deploy Keys) e cole em Settings > Environment Variables.\n",
  );
  process.exit(1);
}

log("Publicando backend e gerando o site");
const deploy = convex(["deploy", "--cmd", "npm run build"]);
if (!deploy.ok) process.exit(1);

log("Conferindo configuração do login");
if (!getEnv("JWT_PRIVATE_KEY") || !getEnv("JWKS")) {
  log("Primeira publicação: criando chaves de login");
  const keys = await generateKeyPair("RS256", { extractable: true });
  const privateKey = (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, " ");
  const jwks = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(keys.publicKey)) }] });
  setEnv("JWT_PRIVATE_KEY", privateKey);
  setEnv("JWKS", jwks);
}

const host = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
if (host) {
  const siteUrl = host.startsWith("http") ? host : `https://${host}`;
  if (getEnv("SITE_URL") !== siteUrl) setEnv("SITE_URL", siteUrl);
}

for (const name of ["ADMIN_EMAILS", "AUTH_RESEND_KEY", "AUTH_EMAIL_FROM"]) {
  const value = process.env[name];
  if (value && getEnv(name) !== value) {
    log(`Atualizando ${name}`);
    setEnv(name, value);
  }
}
if (!process.env.ADMIN_EMAILS && !getEnv("ADMIN_EMAILS")) {
  console.warn("[hub] Atenção: ADMIN_EMAILS não definido. Ninguém vai conseguir entrar como admin.");
}

log("Conferindo dados iniciais");
const seed = convex(["run", "seed:run"], { quiet: true });
console.log(seed.ok ? `[hub] ${seed.out}` : `[hub] Seed não rodou: ${seed.err}`);

const admins = (process.env.ADMIN_EMAILS || getEnv("ADMIN_EMAILS")).split(",").map((e) => e.trim()).filter(Boolean);
const site = getEnv("SITE_URL");
if (admins.length && site) {
  const links = convex(["run", "access:ensureAdminLinks", JSON.stringify({ emails: admins })], { quiet: true });
  if (links.ok) {
    try {
      const list = JSON.parse(links.out);
      console.log("\n[hub] ===== SEU LINK DE ACESSO (admin) =====");
      for (const l of list) console.log(`[hub] ${l.email}: ${site}/acesso/${l.token}`);
      console.log("[hub] Guarde este link. Ele entra direto, sem e-mail.\n");
    } catch {
      console.log(`[hub] Links de admin: ${links.out}`);
    }
  }
}

log("Pronto");
