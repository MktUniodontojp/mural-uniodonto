# Mural Uniodonto — Sistema de Comunicação com Cooperados

Sistema simples e completo para publicar notícias, comunicados e materiais para os cooperados, organizados em **timeline cronológica** e por **categorias**, com **painel administrativo** protegido por login.

## O que o sistema faz

- Área pública (mural) onde qualquer cooperado vê os materiais publicados, filtrando por categoria ou buscando por palavra-chave.
- Painel administrativo (login obrigatório) onde você cria, edita e exclui notícias/materiais, anexa arquivos (PDF, imagens, planilhas etc.), marca como destaque, agenda data de publicação e controla rascunho vs. publicado.
- Gestão de categorias (cores e nomes próprios, ex: Comunicados, Financeiro, Assembleias, Documentos).
- Gestão de usuários: você (admin) pode cadastrar outros administradores ou editores para ajudar a postar conteúdo, sem dar acesso total a todos.
- Cada usuário pode trocar a própria senha.

Tudo guardado em um arquivo de dados simples (sem necessidade de configurar banco de dados externo) e arquivos enviados ficam numa pasta de uploads.

## Estrutura do projeto

```
.
├── server.js          → servidor (API + serve o site)
├── db.js               → "banco de dados" em arquivo JSON (lowdb)
├── auth.js              → login e proteção de rotas
├── package.json
├── render.yaml          → configuração de deploy automático no Render
├── public/
│   ├── index.html        → estrutura e estilo visual
│   └── app.js              → toda a lógica do site (timeline, painel admin etc.)
├── data/                  → onde fica o banco de dados (db.json) — criado automaticamente
└── uploads/                → onde ficam os arquivos enviados — criado automaticamente
```

## Testando no seu computador (opcional, antes de publicar)

Pré-requisito: ter o [Node.js](https://nodejs.org) instalado (versão 18 ou mais recente).

```bash
npm install
cp .env.example .env
npm start
```

Acesse `http://localhost:3000`. O sistema cria automaticamente um usuário administrador na primeira vez que rodar, usando os dados do arquivo `.env`:

- E-mail: o que estiver em `ADMIN_EMAIL` (padrão: `admin@uniodonto.com`)
- Senha: o que estiver em `ADMIN_PASSWORD` (padrão: `admin123`)

**Troque a senha assim que entrar pela primeira vez**, em "Minha conta" no painel.

---

## Colocando no ar gratuitamente (Render.com — recomendado)

O [Render](https://render.com) tem um plano gratuito que serve bem esse sistema, incluindo **disco persistente gratuito** (1 GB) para os dados e arquivos não se perderem quando o servidor reiniciar — isso é importante porque o plano free "dorme" o servidor após um tempo sem uso e ele reinicia ao receber a próxima visita.

### Passo a passo

1. **Crie uma conta gratuita no Render**: [render.com](https://render.com) (pode entrar com GitHub).

2. **Coloque este projeto no GitHub** (o Render publica direto de um repositório):
   - Crie um repositório novo no [github.com/new](https://github.com/new) (pode ser privado).
   - Suba os arquivos deste projeto para esse repositório (pelo site do GitHub mesmo, em "uploading an existing file", ou via linha de comando se preferir).

3. **No Render, clique em "New +" → "Blueprint"** e selecione o repositório que você acabou de criar. O Render vai detectar automaticamente o arquivo `render.yaml` incluído no projeto e configurar tudo (servidor + disco persistente) sozinho.

   Se preferir configurar manualmente em vez de usar o Blueprint, clique em **"New +" → "Web Service"**, selecione o repositório, e configure:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free
   - Em **"Disks"**, adicione um disco: nome `mural-dados`, **Mount Path**: `/data-persistente`, tamanho 1 GB.
   - Em **"Environment Variables"**, adicione:
     - `JWT_SECRET` → qualquer texto longo e aleatório (ex: gere em [generate-secret.vercel.app](https://generate-secret.vercel.app/32))
     - `ADMIN_EMAIL` → o e-mail que você quer usar para entrar como administrador
     - `ADMIN_PASSWORD` → uma senha provisória (troque após o primeiro login)
     - `DATA_DIR` → `/data-persistente`

4. Clique em **criar/publicar**. Em poucos minutos o Render te dará um endereço do tipo `https://mural-uniodonto.onrender.com` — esse é o link que você vai compartilhar com os cooperados.

5. Acesse `/login` nesse endereço (ex: `https://mural-uniodonto.onrender.com/#/login`) e entre com o e-mail/senha que você definiu. Troque a senha imediatamente em "Minha conta".

### Observação sobre o plano gratuito do Render

O plano free "dorme" o site depois de um tempo sem visitas, e demora ~30-50 segundos para "acordar" na próxima visita — isso é normal e não afeta os dados, só a velocidade da primeira carga do dia. Os dados (notícias, categorias, usuários, arquivos) ficam seguros no disco persistente configurado no passo 3.

---

## Outras opções de hospedagem gratuita

O sistema é um app Node.js padrão, então também funciona em qualquer serviço similar ao Render, como **Railway** ou **Fly.io** (ambos com camadas gratuitas). A única adaptação necessária é garantir que a variável `DATA_DIR` apunte para uma pasta com armazenamento persistente (nem todo serviço gratuito oferece isso — sem isso, os dados se perdem a cada reinício do servidor).

---

## Uso do dia a dia

### Publicar uma notícia ou material
1. Entre no painel (`/#/login`).
2. Clique em **"+ Novo material"**.
3. Preencha título, resumo (aparece na lista), conteúdo completo (opcional, aparece em "Ler mais"), escolha a categoria, anexe arquivos se quiser, e marque se é destaque.
4. Deixe "Publicar agora" marcado para já ficar visível aos cooperados, ou desmarque para salvar como rascunho (só admins/editores veem rascunhos).

### Organizar por categorias
Vá em **"Categorias"** no menu lateral para criar novas categorias com nome e cor próprios (ex: "Assembleias", "Capacitação", "Convênios"). Categorias em uso não podem ser excluídas até você remover ou trocar a categoria dos materiais que dependem dela.

### Dar acesso a outras pessoas da cooperativa
Vá em **"Usuários"** (só administradores veem essa opção) e cadastre um editor ou outro administrador com e-mail e senha provisória. A pessoa pode trocar a senha depois em "Minha conta".

---

## Segurança — pontos de atenção

- Troque a senha padrão do admin logo no primeiro acesso.
- Defina um `JWT_SECRET` longo e aleatório em produção (nunca deixe o valor de exemplo).
- O sistema não tem cadastro público de usuários — só administradores criam novos acessos, o que é intencional para controlar quem pode publicar.
