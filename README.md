# Hub Social Media

Central onde os clientes do estúdio veem o planejamento do mês, aprovam conteúdos, comentam e mandam ideias.

Stack: Next.js 16 (App Router), TypeScript, Tailwind 4, Convex (banco, arquivos, tempo real e login), Vercel.

## O que já funciona (etapa 1: fundação)

- Login sem senha com código de 6 dígitos por e-mail, sessão de 30 dias
- Dois papéis: **admin** vê tudo; **cliente** só o próprio workspace (regra aplicada no servidor)
- Convites: só entra quem foi convidado ou está em `ADMIN_EMAILS`
- Estúdio (admin): o que precisa de você + resumo do mês por cliente
- Início do cliente: mês atual, contadores, fila "esperando você", ajustes e próximos no ar
- Design system em código: cores, Inter Tight, adesivo, caixa de seleção, asterisco, status
- Banco completo já modelado: clientes, conteúdos, mídias, legendas, decisões, comentários, ideias, datas e histórico
- 4 clientes iniciais (Lili, Vivi, Entalpia, Bia), datas por nicho e um mês de exemplo

Calendário, Conteúdo (aprovação), Datas e Ideias já estão na navegação e chegam nas próximas etapas.

## Rodar pela primeira vez

Precisa de Node 20+ e uma conta gratuita no [Convex](https://convex.dev).

```bash
npm install

# 1. Cria o banco no Convex e gera .env.local (pede login no navegador)
npx convex dev
#    Deixe rodando em um terminal. Ele atualiza o banco a cada alteração.

# 2. Em outro terminal: configura as chaves de login
npx @convex-dev/auth

# 3. Define quem é admin
npx convex env set ADMIN_EMAILS seu@email.com

# 4. Cria clientes, datas e o mês de exemplo
npx convex run seed:run

# 5. Sobe o site
npm run dev
```

Abra http://localhost:3000, digite seu e-mail e pegue o código.

**Sem Resend configurado**, o código não vai por e-mail: ele aparece nos logs do Convex (no terminal do `npx convex dev` ou no painel, em Logs). Bom para testar.

## Mandar o código por e-mail de verdade

1. Crie uma conta no [Resend](https://resend.com) e verifique seu domínio.
2. Configure no Convex:

```bash
npx convex env set AUTH_RESEND_KEY re_xxx
npx convex env set AUTH_EMAIL_FROM "Hub Social Media <acesso@seudominio.com.br>"
```

## Liberar acesso para um cliente

```bash
npx convex run invites:createFromCli '{"email":"lili@email.com","name":"Lili","role":"cliente","clientSlug":"lili"}'
```

Depois mande no WhatsApp: "Seu planejamento está em https://seusite.com.br. Entre com este e-mail e use o código que chegar."

## Publicar na Vercel

1. Suba o projeto para o GitHub e importe na Vercel.
2. No Convex, crie uma **Production Deploy Key** (Settings > Deploy keys).
3. Na Vercel, adicione a variável `CONVEX_DEPLOY_KEY` e troque o comando de build para:

```
npx convex deploy --cmd 'npm run build'
```

4. Rode `npx @convex-dev/auth --prod` e repita `ADMIN_EMAILS`, `AUTH_RESEND_KEY` e `AUTH_EMAIL_FROM` com `--prod`.
5. Rode o seed em produção: `npx convex run seed:run --prod`.

## Estrutura

```
convex/
  schema.ts        tabelas e índices
  auth.ts          login, convites, papéis
  otp.ts           código de 6 dígitos por e-mail
  lib/access.ts    regra de acesso admin x cliente (toda função passa aqui)
  lib/content.ts   contagens e formatação de conteúdo
  clients.ts       workspace e visão do estúdio
  dashboard.ts     Início do cliente e caixa de entrada da admin
  invites.ts       convites
  seed.ts          dados iniciais
src/
  proxy.ts                 exige login antes de qualquer página
  app/entrar               login por código
  app/estudio              painel da admin
  app/w/[cliente]          workspace (Início, Calendário, Datas, Ideias, Conteúdo)
  components/brand.tsx     peças do design system
  lib/dates.ts             datas no fuso de São Paulo
```

`convex/_generated` é recriado pelo `npx convex dev`. Não edite à mão.
