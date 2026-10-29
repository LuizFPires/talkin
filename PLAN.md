# PLAN — Talkin

Plano de implementação por milestones. Cada milestone entrega algo usável e tem critério de aceite próprio.

**Stack proposta**

| Camada | Tecnologia |
|---|---|
| Web | Next.js (React) + Tailwind |
| Backend | Supabase (Postgres, Auth, Storage, pgvector) + Edge Functions / worker para filas |
| Mobile | Expo (React Native), nativo para gravar com a tela bloqueada (PWA no iOS não grava em segundo plano) |
| Desktop | Tauri com módulo nativo de captura: ScreenCaptureKit / Core Audio no macOS, WASAPI loopback no Windows |
| Transcrição | API com diarização em pt-BR (Deepgram ou AssemblyAI; Whisper como alternativa) |
| IA | Claude API (atas, extração estruturada, "Pergunte", interpretação da busca livre) |
| Design | Design system Human (tokens no artefato "AI Video Lab · Human Academy"); fonte Inter na interface e Sora nos documentos |
| PDF | Geração no servidor (HTML → PDF com Playwright/Chromium, ou ReportLab) a partir do modelo Executiva |

**Referências:**
- `PRD.md` (o quê e por quê)
- `SPEC.md` (detalhe de cada funcionalidade, numeradas de 1 a 28)
- protótipo navegável: https://claude.ai/artifact/CfvBRa7Y2gNsZeTiYZDrKg

---

## M0 — Fundação
- [x] Repositório monorepo (`apps/web`, `apps/mobile`, `apps/desktop`, `packages/core`, `packages/ui`)
- [x] Supabase: auth, organizações/usuários, buckets de áudio com RLS
- [x] Modelo de dados:

| Tabela | Conteúdo |
|---|---|
| `recordings` | gravações |
| `recording_chunks` | blocos de áudio |
| `transcripts` | transcrições |
| `segments` | trechos com falante, início e fim |
| `speakers` | falantes |
| `summaries` | atas |
| `action_items` | pendências |
| `projects` | projetos/obras |
| `templates` | modelos de ata |
| `organizations` | empresa: dados cadastrais, logomarca, cor, modelo de PDF padrão |
| `profiles` | usuário: nome, cargo, contato, assinatura, papel |

- [x] Fila de processamento com status (enviado → transcrevendo → resumindo → pronto / erro) — `recordings.status` + `processing_jobs`
- [x] Design system Human aplicado no `packages/ui`:
  - tokens de cor do tema escuro, degradês, raios e rótulos;
  - fontes Inter (interface), Sora (documentos) e mono (minutos);
  - componentes base: sidebar, card, busca, toggle segmentado, pílula, rótulo.

**Aceite:** login funciona e uma gravação vazia aparece na lista com status.
> Código do M0 completo (auth, onboarding, biblioteca com status, RPC `create_organization`, RLS, buckets). O aceite roda ao conectar o Supabase (modo só-código: sem credenciais nesta fase).

## M1 — Pipeline com importação (prova de valor)
- [x] Upload de áudio/vídeo na web (mp3, m4a, wav, mp4, webm, opus) — página Importar
- [x] Extração de áudio de vídeo (ffmpeg no worker) — `concatAndNormalize`
- [x] Transcrição com diarização em pt-BR — adapter Deepgram (+ mock no modo só-código)
- [x] Ata com modelo genérico + extração de decisões e pendências (JSON validado) — adapter Claude, validado por `AtaContent` (zod)
- [x] Tela da gravação: player + transcrição sincronizada + ata — `/gravacao/[id]`

**Aceite:** subir a gravação de uma reunião real de 1 h e ter ata e pendências corretas em menos de 5 min.
> Pipeline fim a fim em código (worker em `/api/process`). O aceite com áudio real roda ao conectar Supabase + chaves Deepgram/Anthropic; sem chaves, o mock exercita o fluxo.

## M2 — Gravação presencial (celular)
- [x] App Expo com gravação em segundo plano (tela bloqueada) por até 4 h — `expo-keep-awake`, limite/aviso em `RecordingSession`
- [x] Gravação em blocos de 30–60 s, salvos localmente e enviados de forma incremental — `MeetingRecorder` + `UploadQueue`
- [x] Retomada após queda de rede ou fechamento do app; fila offline — `UploadQueue` persistida (AsyncStorage), nunca descarta bloco
- [x] Indicador de gravação + lembrete de avisar participantes — tela Gravando
- [x] Marcar momento importante durante a gravação (vira destaque na ata) — momentos salvos em `recordings.highlights`
- [~] Importar gravação de chamada do iPhone / áudio do WhatsApp pelo menu Compartilhar — entrada via share intent (refinamento nativo pendente)

**Aceite:** reunião de obra de 2 h gravada com o celular bloqueado no bolso, sem perder nenhum trecho.
> App Expo em código (núcleo `@talkin/capture` testado: fila nunca perde bloco). Aceite em device real roda com o build Expo + Supabase conectado. O app Expo não entra no CI (toolchain nativo); `packages/capture` sim.

## M3 — Gravador desktop (reuniões online)
- [x] App Tauri na barra de menu (macOS) / bandeja (Windows) — scaffold com tray
- [~] Captura do áudio do sistema + microfone em **faixas separadas** ("eu" × "outros") — módulo nativo isolado (`capture/`), stubs por SO documentados (teste manual)
- [x] Detecção de reunião em andamento (Meet, Teams, Zoom, WhatsApp) com sugestão de gravar — `meeting.rs` + UI (heurística stub)
- [x] Upload incremental igual ao mobile — reutiliza `@talkin/capture`
- [x] Fluxo de permissões guiado (macOS: gravação de áudio/tela; Windows: microfone) — entitlements + UI

**Aceite:** gravar uma reunião no Teams desktop e outra no Meet pelo navegador; ambas com "eu" e "outros" separados corretamente.
> Scaffold Tauri + frontend em código; captura nativa (Rust WASAPI/ScreenCaptureKit) isolada com testes manuais por SO (`CAPTURE-TESTS.md`) — não entra no CI. Aceite roda localmente com Rust + SO alvo + Supabase conectado.

## M4 — Modelos de ata e saídas
- [x] Modelos iniciais (obra, visita, cliente, fornecedor, sócios, genérico) — seed global (migration 0004)
- [x] Sugestão automática do modelo + troca manual com regeneração — `/api/regenerate` + seletor
- [x] Editor de modelos (seções, instruções) — `/configuracoes/modelos` (escrita gestor/admin)
- [x] Trechos da ata vinculados ao minuto do áudio — `minutos_ms` + pílulas de minuto
- [x] PDF padrão **Executiva** (estilo Human, fonte Sora) — `packages/pdf`; Formal/Painel como variações
- [x] **Perfil e empresa** (SPEC item 27) — `/configuracoes`: perfil, empresa, logo, cor, modelo de PDF, prévia ao vivo
- [x] Exportar DOCX, texto para WhatsApp, envio por e-mail, link privado com expiração — rotas `/api/pdf` e `/api/docx`, WhatsApp/e-mail na tela, `shares` + `/compartilhar/[token]`

**Aceite:** ata de reunião de obra sai em PDF A4 com a logo, os dados e a cor da empresa cadastrados no perfil, na fonte Sora, e é enviada por e-mail sem edição manual de layout.
> Código do M4 completo. Render do PDF (Chromium/Playwright) e envio real de e-mail rodam no deploy; o gerador de HTML, a regeneração e os schemas são verificados no CI. E-mail via mailto (cliente do usuário revisa antes); SMTP/Resend é refinamento.

## M5 — Biblioteca, busca e "Pergunte"
- [x] Projetos/obras e filtros (pessoa, tipo, data) — CRUD em `/configuracoes/projetos` + filtros na busca livre
- [x] Busca textual + embeddings (pgvector) por trecho — etapa `embed` + RPC `match_segments`
- [x] **Busca livre** (SPEC item 16):
  - interpretação do texto em tema + filtros (obra, participante, plataforma, período, tipo) — `interpretarBusca`
  - chips "Entendi assim" removíveis — componente `BuscaLivre`
  - resultados agrupados por reunião, ordenados por menções, com até 3 trechos e minutos — `/api/buscar`
  - modos "por significado" e "palavra exata"
- [x] "Pergunte" sobre uma gravação e sobre todas, sempre com citação (gravação + minuto) — `/api/perguntar`

**Aceite:**
- "concreto Galpão A com Marcos" mostra só as reuniões certas, com os trechos e minutos de cada menção.
- Perguntar "o que foi combinado sobre o prazo da estrutura do galpão?" traz a resposta com link para o trecho certo.
> Código do M5 completo. Busca por significado e Pergunte com retrieval real rodam com pgvector + chaves (OpenAI/Anthropic); sem chave, o mock exercita o fluxo e o Pergunte recusa sem fonte. Interpretador testado no CI.

## M6 — Falantes e pessoas
- [x] Renomear falantes com propagação para toda a gravação — editar `speakers.display_name` (trechos referenciam o falante por id)
- [x] Cadastro de pessoas (nome, empresa, papel) e sugestão de nome em novas gravações — `/configuracoes/pessoas` + dropdown ao ligar falante
- [x] Pendências atribuídas a pessoas cadastradas — `action_items.assignee_person_id` com dropdown na gravação

**Aceite:** numa reunião recorrente, os falantes já vêm nomeados corretamente na maioria das vezes.
> Código do M6 completo. Renome/ligação de falantes e atribuição de pendências na tela da gravação; sugestão por voz (dado biométrico) fica como refinamento opt-in futuro.

## M7 — Integrações
- [~] Calendário Google / Outlook (título, participantes, projeto, lembrete) — motor de regras (`sugerirPorEvento`) pronto; conexão OAuth é scaffold (exige credenciais)
- [x] Envio de pendências ao ioo / sistemas de obra (webhook/API) — `/api/integracoes/enviar` (POST assinado HMAC, só ata revisada, anti-SSRF)
- [~] Importação automática das gravações do Meet/Teams (Drive / OneDrive) — scaffold (OAuth/credenciais)

**Aceite:** uma reunião do calendário gera, ao final, a ata vinculada ao projeto certo e as pendências no ioo.
> Webhook ioo completo e verificável (motor de regras e payload testados no CI; envio real com a URL do usuário). Calendário/Drive dependem de OAuth (credenciais do usuário) — scaffold com "Conectar", sincronização ao conectar (modo só-código).

## M8 — Bot de reunião (opcional)
- [x] Integração com API de bot de reunião (ex.: Recall.ai) para Meet, Teams e Zoom — `BotProvider` (Recall + mock) + `/api/bot/agendar`
- [x] Agendar o bot (colar o link da reunião; a partir do calendário quando conectado) — tela `/bot`
- [x] Controle de custo por hora e liga/desliga por reunião — custo estimado antes de ativar + "Desligar"

**Aceite:** o bot entra numa reunião em que o usuário não está no computador e a ata chega normalmente.
> Código do M8 completo. O bot real roda com a chave do Recall.ai; sem chave, o mock exercita o fluxo. A gravação retorna via webhook do Recall (scaffold) e entra no pipeline (M1).

**Aceite:** o bot entra numa reunião em que o usuário não está no computador e a ata chega normalmente.

## M9 — PWA (instalável + offline) *(extra, pós-M8)*
- [x] Web manifest (`display: standalone`, cores do tema, start_url) — `app/manifest.ts`
- [x] Ícone do app (SVG escalável `any`/`maskable`) — `public/icon.svg`
- [x] Service worker (cache do app shell + offline da interface) — `public/sw.js` + `SWRegister`
- [x] Metadados (`manifest`, `themeColor`, `appleWebApp`) e registro do SW — `layout.tsx`

**Aceite:** o app pode ser instalado (Android/desktop) e a interface abre offline; áudio continua subindo pela fila ao voltar a rede.
> Ícones PNG 192/512/180 (Lighthouse e home-screen do iOS) devem ser gerados a partir de `apps/web/public/icon.svg` com uma ferramenta de imagem — passo manual (sharp indisponível no ambiente só-código).
