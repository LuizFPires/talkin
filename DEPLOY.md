# Deploy do Talkin

Stack de produção: **Supabase** (Postgres + Auth + Storage + pgvector) + **Vercel** (app web Next.js). Mobile (Expo) e desktop (Tauri) têm build próprio, fora deste fluxo.

## 1. Supabase (banco, auth, storage)

1. Crie um projeto em supabase.com (região mais perto dos usuários).
2. Habilite a extensão **vector** (pgvector) — já incluída nas migrations.
3. Aplique as migrations `supabase/migrations/0001…0011`:
   - **CLI:** `supabase link --project-ref <ref>` e `supabase db push` (pede a senha do banco), ou
   - **SQL editor:** cole cada arquivo em ordem (0001 → 0011).
4. Em **Storage**, confirme os buckets privados `audio` e `logos` (criados pela 0003).
5. Anote de Project Settings → API:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (**secreto**; só no servidor)

## 2. Vercel (app web)

- **Root Directory:** `apps/web` (monorepo pnpm; o Vercel instala a partir da raiz do workspace).
- **Install:** `pnpm install` · **Build:** `next build` (o `packageManager` fixa pnpm 11 via corepack).
- Variáveis de ambiente (Project → Settings → Environment Variables) — **você cola os valores**:

| Variável | Para quê | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (cliente) | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | worker/rotas (pipeline, webhook, bot) | sim |
| `NEXT_PUBLIC_APP_URL` | links/base | recomendado |
| `DEEPGRAM_API_KEY` | transcrição (M1) | p/ transcrever |
| `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL`) | ata/Pergunte | p/ ata e Pergunte |
| `OPENAI_API_KEY` | embeddings (M5) | p/ busca por significado |
| `RECALL_API_KEY` (+ `NEXT_PUBLIC_BOT_CENTS_PER_HOUR`) | bot de reunião (M8) | p/ bot |

> Sem as chaves de IA/transcrição o app sobe e navega; o pipeline usa mocks. Com as chaves, roda de verdade.

## 3. Depois do primeiro deploy

- Em Supabase → Auth → URL Configuration, aponte `Site URL`/redirects para o domínio do Vercel.
- Crie a primeira empresa pelo app (tela "Começar"), que vira admin.

## Limitações conhecidas

- **PDF da ata** (`/api/pdf`) usa Chromium (Playwright). Em serverless do Vercel, use `@sparticuz/chromium` + `playwright-core` ou um worker dedicado; localmente roda direto.
- **OAuth** Google/Microsoft (agenda, import Meet/Teams) é scaffold — exige configurar os apps OAuth.
- **Ícones PWA**: gerar PNG 192/512/180 de `apps/web/public/icon.svg`.
