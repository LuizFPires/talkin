# CLAUDE.md — Talkin

Contexto para o Claude Code trabalhar neste repositório.

## O que é
Gravador inteligente de reuniões (inspirado no Plaud Note). Ele faz quatro coisas:
- grava reuniões presenciais (celular) e online (desktop, áudio do sistema + microfone, qualquer plataforma);
- transcreve com falantes;
- gera atas por modelo;
- permite buscar e perguntar sobre as gravações.

Documentos de referência:
- `PRD.md`: o quê e por quê.
- `SPEC.md`: detalhe de cada funcionalidade, numeradas de 1 a 28.
- `PLAN.md`: milestones. Sempre conferir em qual milestone estamos antes de implementar.
- Protótipo navegável com todas as telas: https://claude.ai/artifact/CfvBRa7Y2gNsZeTiYZDrKg. Use-o como referência de fluxo e layout.

## Estrutura
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

## Regras do projeto
- **Idioma:** interface, mensagens e prompts em pt-BR.
- **Formato brasileiro:** valores em R$ 1.234,56 e datas dd/mm/aaaa.
- **Áudio é dado sensível:**
  - nunca logar conteúdo de transcrição;
  - buckets privados com RLS;
  - links de compartilhamento sempre com expiração.
- **Indicador de gravação:** nunca gravar sem indicador visível. Não implementar gravação oculta.
- **Upload em blocos:** gravação sempre em blocos com upload incremental e retomada. Perder áudio é o pior bug possível.
- **Saída da IA:** extração estruturada (pendências, decisões, valores) sempre em JSON validado por schema zod antes de salvar.
- **Citações:** toda resposta do "Pergunte" cita gravação + minuto. Sem citação, não responde.
- **Captura isolada:** o código de captura nativa (macOS/Windows) fica isolado em um módulo pequeno, com testes manuais documentados por versão de SO.
- **Custos:** registrar custo de transcrição e de IA por gravação.

## Design
- **Design system:** Human (AI Video Lab · Human Academy). Tokens e regras no artefato do design system e em `Desktop/Claude/@Design Systems/Design System Human`. Nunca inventar cores fora dos tokens.
- **Tema do app:** escuro.
  - Fundo `#030707`; cards `#060606`; bordas opacas `#2b2b2b`.
  - Texto `#f5f5f7`; secundário `#98989d`.
- **Acento:** menta `#94efda`, uma vez por região; foco (`ring`) também em menta.
- **Hierarquia:** por escurecimento e bordas, sem sombra. Degradê só em painéis (sidebar `#0f1c1d → #070f11`, item ativo `#283334 → #1b2728`).
- **Rótulos:** caixa alta, 11 px, peso 500, tracking `.18em`, cor `#798e91`.
- **Raios:** 24 px painéis · 16 px cards e busca · 12 px itens de menu · pílula em botões, toggles e chips.
- **Fontes:**
  - Inter na interface;
  - **Sora** em todo documento gerado (PDF da ata);
  - mono nos minutos do áudio, que aparecem sempre em pílula.
- **PDF da ata:** modelo Executiva é o padrão (SPEC item 28). Logo, dados e cor vêm de `organizations` (Perfil e empresa). Sem logo, usar o nome fantasia. Nunca deixar título de seção órfão no fim da página.

## Busca livre
- Um campo só. O texto é interpretado em tema + filtros (obra, participante, plataforma, período, tipo) usando o cadastro real da empresa.
- Sempre mostrar ao usuário como o texto foi entendido (chips removíveis) antes dos resultados.
- Resultados agrupados por reunião, com trechos e minuto.

## Pipeline
upload de blocos → concatenação/normalização (ffmpeg) → transcrição com diarização → segmentação → ata por modelo (Claude) → extração estruturada → embeddings → pronto

Cada etapa atualiza o status em `recordings` e pode ser reprocessada isoladamente.

## Ao terminar uma tarefa
- Marcar o item no `PLAN.md`.
- Validar contra o critério de aceite do milestone.
- Testar com áudio real em pt-BR (há amostras em `fixtures/audio/`).

## Decisões tomadas

### M0 — Fundação *(auto — recomendado)*
- **Monorepo:** pnpm workspaces + Turborepo (cache de build/lint/test). Node 24, pnpm 11.
- **Web:** Next.js 15 (App Router) + TypeScript + Tailwind v4; tokens Human como CSS variables.
- **Backend:** Supabase (Postgres + Auth + Storage + pgvector). Migrations em SQL versionadas em `supabase/migrations`.
- **Login:** Supabase Auth com e-mail + senha no M0; Google/Microsoft (OAuth) e e-mail+código ficam preparados para milestone posterior (SPEC 23).
- **Multi-tenancy / RLS:** toda tabela de dados tem `organization_id`; acesso por RLS via `memberships(organization_id, user_id, role)`. Papéis: `admin`, `gestor`, `membro` (SPEC 23).
- **Visibilidade da gravação:** enum `privada | projeto | empresa`, padrão `privada` (SPEC 23).
- **Fila de processamento:** status enum em `recordings` (`enviado → transcrevendo → segmentando → resumindo → pronto | erro`) + tabela `processing_jobs` para reprocessar etapas isoladamente (CLAUDE.md Pipeline).
- **Convenções de dados:** `id uuid` (gen_random_uuid), timestamps `timestamptz`, soft-delete via `deleted_at` (lixeira de 30 dias, SPEC 24).
- **Buckets de áudio:** privados, uma pasta por organização, RLS por membership; links de compartilhamento sempre com expiração.
- **Qualidade:** ESLint + Prettier, Vitest para testes, `tsc --noEmit` para tipos. CI no GitHub Actions (lint + types + build + test).
- **Mobile/Desktop no M0:** apenas esqueleto do monorepo (Expo e Tauri). A captura real é M2/M3.

### M1 — Pipeline com importação *(auto — recomendado)*
- **Pipeline isolado em `packages/pipeline`** (Node/TS), orquestrando as etapas e atualizando `recordings.status` + `processing_jobs`. Em produção roda como worker de fila; no scaffolding é a função `processRecording(id)`.
- **Provedores com abstração + stub:** interfaces `TranscriptionProvider` e `AtaProvider`. Adapters reais (Deepgram para transcrição com diarização pt-BR; Anthropic Claude para ata/extração) são selecionados por env; sem chave, usa `MockProvider` determinístico — assim o pipeline roda fim a fim no modo só-código.
- **Transcrição:** Deepgram (nova-2, `language=pt-BR`, `diarize`) como primário; AssemblyAI como alternativa.
- **Extração de áudio/concatenação:** ffmpeg via processo (`spawn`) no worker; normalização de volume.
- **IA (ata + extração estruturada):** Claude via `@anthropic-ai/sdk`; a extração (decisões, pendências, valores, prazos, riscos) volta como JSON **validado por schema zod** antes de salvar; cada frase guarda os trechos de origem (minutos).
- **Upload (importação, SPEC 4):** upload direto do navegador para o Storage (bucket `audio`) + cria `recording` + enfileira job. Blocos/retomada da gravação ao vivo é M2.
- **Custos (SPEC 25):** cada etapa registra custo de transcrição e de IA em `recordings.cost_*` (gravadas pelo worker via service_role).
- **Embeddings:** etapa `embed` existe no pipeline mas é no-op no M1; a busca semântica entra no M5.
- **Tela da gravação (SPEC 12/13):** abas Ata · Transcrição · Pergunte (Pergunte só no M5); player com botões de minuto e transcrição sincronizada.

### M2 — Gravação presencial (celular) *(auto — recomendado)*
- **Núcleo de captura em `packages/capture`** (TS puro, sem RN): `ChunkScheduler` (fatia a gravação em blocos de 30–60 s) e `UploadQueue` (upload incremental, retomada, fila offline com persistência por porta). Testado com Vitest e **reutilizado pelo desktop (M3)**. Perder áudio é o pior bug — a fila nunca descarta um bloco sem confirmação do servidor.
- **App Expo (`apps/mobile`)** com expo-router: telas Biblioteca e Gravando. Gravação com `expo-av`; blocos salvos em `expo-file-system`; `expo-keep-awake` + `expo-task-manager` para seguir com a tela bloqueada; `expo-notifications` para o indicador permanente de gravação.
- **Indicador sempre visível** (SPEC 6): nunca gravar sem indicador; lembrete "avise os participantes" no início; sem modo oculto.
- **Marcar momento** (SPEC 5): guarda o instante (ms) e rótulo opcional; vira destaque na ata (passado ao pipeline em `highlights`).
- **Limites** (SPEC 1): até 4 h (aviso aos 3h45, corta e encadeia nova gravação); AAC/M4A mono; pausa em ligação; aviso de espaço < 500 MB.
- **Importar do Compartilhar** (iPhone/WhatsApp, SPEC 4): ponto de entrada via share intent; reaproveita o fluxo de upload.
- **CI:** `packages/capture` entra na verificação (typecheck/test). O app Expo não roda no CI (toolchain nativo pesado); é exercitado localmente via Expo, como os esqueletos nativos.
