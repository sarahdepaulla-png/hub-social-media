# Hub Social Media

Central onde os clientes do estúdio veem o planejamento do mês, aprovam conteúdos, comentam e mandam ideias.

Next.js 16, TypeScript, Tailwind 4, Convex (banco, arquivos, tempo real e login) e Vercel.

---

## Colocar na web (sem terminal, uns 15 minutos)

Você vai precisar de 3 contas gratuitas: [GitHub](https://github.com/signup), [Vercel](https://vercel.com/signup) (entre com o GitHub) e [Convex](https://dashboard.convex.dev) (entre com o GitHub também).

### 1. Subir o código para o GitHub

1. Descompacte o zip
2. No GitHub, clique em **New repository**, dê o nome `hub-social-media`, deixe **Private** e clique em **Create repository**
3. Na página do repositório vazio, clique em **uploading an existing file**
4. Abra a pasta `hub-social-media` no seu computador, selecione **tudo que está dentro dela** e arraste para a página. Mostre os arquivos ocultos antes (no Mac: Cmd+Shift+ponto) para levar o `.gitignore`
5. Clique em **Commit changes**

### 2. Criar o banco no Convex

1. Em [dashboard.convex.dev](https://dashboard.convex.dev), clique em **Create Project** e dê o nome `hub-social-media`
2. Abra o projeto, troque para **Production** no seletor do topo
3. Vá em **Settings > Deploy Keys**, clique em **Generate Production Deploy Key** e copie a chave

### 3. Publicar na Vercel

1. Na Vercel, clique em **Add New > Project** e importe o repositório `hub-social-media`
2. Abra **Environment Variables** e adicione:

| Nome | Valor |
|---|---|
| `CONVEX_DEPLOY_KEY` | a chave copiada do Convex |
| `ADMIN_EMAILS` | seu e-mail (vários: separe por vírgula) |

3. Clique em **Deploy**

O deploy demora uns 3 minutos e faz sozinho: publica o banco, cria as chaves de login, define você como admin e cria Lili, Vivi, Entalpia e Bia com um mês de exemplo. No fim, a Vercel mostra o endereço do site (algo como `hub-social-media.vercel.app`).

### 4. Entrar

1. Na Vercel, abra **Deployments**, clique no deploy e depois em **Build Logs**
2. Procure **SEU LINK DE ACESSO**. Copie o link e abra: você entra direto como admin
3. Salve esse link nos favoritos do celular e do computador

Nenhum e-mail ou domínio é necessário.

### 5. Dar acesso aos clientes

1. No Hub, vá em **Clientes e acessos**, abra o cliente e preencha nome e e-mail em **Criar acesso**
2. Clique em **Enviar link no WhatsApp**. A pessoa toca no link e entra direto, sem senha
3. Para tirar o acesso: **Tirar acesso**. Se o link vazou: **Gerar link novo** (o antigo para na hora)

Toda alteração que você subir no GitHub publica sozinha.

### Opcional: entrar também por código no e-mail

Só se quiser essa segunda forma de entrar. Exige conta no [Resend](https://resend.com) com domínio verificado. Na Vercel, adicione `AUTH_RESEND_KEY` e `AUTH_EMAIL_FROM` e faça **Redeploy**.

### Roteiro de teste

1. **Estúdio**: veja "Precisa de você" e o mês por cliente
2. **Clientes e acessos**: abra a Lili, troque a cor, suba uma foto. Crie um acesso de teste (pode ser um segundo e-mail seu) e copie o link
3. **Lili > Calendário**: o mês com miniaturas, filtros e datas do nicho. Arraste uma peça para outro dia
4. **Lili > Início > Novo conteúdo**: crie uma peça, suba imagens, escreva 2 legendas e clique em **Enviar para aprovação**
5. No celular, abra o **link de acesso** que você gerou para a Lili
6. Como cliente: abra a peça, passe o carrossel, escolha a legenda, **Aprovar**. Teste também **Solicitar ajuste** e **Desfazer**
7. Mande uma ideia na **Caixa de Ideias** e peça conteúdo numa **Data**
8. Volte como admin: a ideia aparece em "Precisa de você". Clique em **Levar ao calendário**

---

## Rodar no computador (opcional, para desenvolver)

```bash
npm install
npx convex dev          # deixe aberto; o código de login aparece aqui
# em outro terminal:
npx @convex-dev/auth    # URL do site: http://localhost:3000
npx convex env set ADMIN_EMAILS seu@email.com
npx convex run seed:run
npm run dev
```

---

## O que o sistema faz

**Cliente** (acessa só o próprio workspace, pelo celular ou computador)
- **Início**: mês atual, contadores, fila "esperando você", ajustes em andamento, próximos no ar
- **Calendário**: mês com miniaturas, filtros por plataforma, formato e status, datas do nicho
- **Conteúdo**: carrossel com arraste, vídeo na página, link externo, prévia de post
- **Legendas**: várias opções, escolhe a favorita, CTA, hashtags e observação
- **Decisão**: Aprovar, Aprovar com observação, Solicitar ajuste. Registra quem, quando e o comentário. Ajuste exige texto e pode apontar o card. Desfazer em até 10 minutos. "Ver o próximo" leva à próxima pendente
- **Comentários** em thread e **histórico** de tudo
- **Datas**: próximos 90 dias do nicho, com "Quero conteúdo sobre isso"
- **Caixa de Ideias**: título, descrição, link e arquivo (até 25 MB)

**Admin**
- **Visão geral**: ajustes pedidos e ideias novas no topo, resumo do mês por cliente
- **Clientes e acessos**: criar cliente, cores, logo, foto, nichos, pausar. Liberar e tirar acesso por e-mail, com mensagem pronta para WhatsApp
- **Biblioteca de datas**: datas por nicho ou só para um cliente, datas de mês inteiro
- **Calendário**: arrastar para reagendar, criar conteúdo em qualquer dia
- **Editor**: ficha, upload de imagens e vídeos (até 100 MB), ordem dos cards, links, legendas, status, enviar para aprovação, nova versão guardando a anterior
- **Ideia ou data para conteúdo**: "Levar ao calendário" já preenche o tema e marca a ideia como convertida

## Segurança

- Só entra quem tem link de acesso ou está em `ADMIN_EMAILS`. Cada link é de uma pessoa e pode ser trocado ou revogado
- A regra admin x cliente fica no servidor (`convex/lib/access.ts`). Trocar o link não dá acesso a outro cliente
- Tirar o acesso vale na hora

## Testes

```bash
npm test
```

20 testes cobrem as regras críticas: isolamento entre clientes, funções de admin bloqueadas para cliente, registro de decisão, ajuste com comentário obrigatório, desfazer, legenda favorita preservada, versões, comentários, datas por nicho, pedido de conteúdo, ideias convertidas, convites, links de acesso e revogação.

## Estrutura

```
convex/
  schema.ts            tabelas e índices
  auth.ts, otp.ts      login por código, convites, papéis
  lib/access.ts        regra de acesso (toda função passa aqui)
  clients.ts           workspace, visão do estúdio, cadastro
  dashboard.ts         Início e caixa de entrada da admin
  calendar.ts          mês do calendário
  contents.ts          peça, decisão, histórico, editor
  media.ts, captions.ts, comments.ts
  ideas.ts, opportunities.ts, invites.ts
  seed.ts              dados iniciais
src/
  proxy.ts             exige login antes de qualquer página
  app/entrar           login
  app/estudio          visão geral, clientes, biblioteca de datas
  app/w/[cliente]      Início, Calendário, Datas, Ideias, Conteúdo, Editor, Novo
  components/brand.tsx peças do design system
tests/                 testes do servidor
```

`convex/_generated` é recriado pelo `npx convex dev`. Não edite à mão.
