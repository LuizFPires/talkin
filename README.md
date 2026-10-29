# Talkin

Gravador inteligente de reuniões (presenciais e online): grava, transcreve com falantes, gera atas por modelo e permite buscar e perguntar sobre as gravações.

- **`PRD.md`** — o quê e por quê.
- **`SPEC.md`** — detalhe de cada funcionalidade (1 a 28).
- **`PLAN.md`** — milestones (M0 a M8) e critérios de aceite.
- **`CLAUDE.md`** — regras do projeto e design.

## Estrutura (monorepo pnpm)

```
apps/
  web/       Next.js — biblioteca, player, atas, configurações
  mobile/    Expo — gravação presencial em segundo plano
  desktop/   Tauri — gravador de reuniões online (módulo nativo de captura)
packages/
  core/      tipos, schemas (zod), prompts, cliente da API
  ui/        tokens e componentes do design system Human
  pdf/       modelos de PDF da ata (Executiva padrão, Formal, Painel)
supabase/
  migrations/  functions/
```

## Desenvolvimento

```bash
pnpm install
pnpm -r build       # compila todos os pacotes
pnpm -r typecheck   # checagem de tipos
pnpm -r lint        # lint
pnpm -r test        # testes
```

Requisitos: Node 24+, pnpm 11+, Docker (Supabase local), Supabase CLI.

> Idioma pt-BR, tema escuro, formato brasileiro (R$ 1.234,56 · dd/mm/aaaa). Áudio é dado sensível: buckets privados com RLS, nunca logar transcrição, links de compartilhamento com expiração.
