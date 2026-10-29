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
- [ ] Repositório monorepo (`apps/web`, `apps/mobile`, `apps/desktop`, `packages/core`)
- [ ] Supabase: auth, organizações/usuários, buckets de áudio com RLS
- [ ] Modelo de dados:

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

- [ ] Fila de processamento com status (enviado → transcrevendo → resumindo → pronto / erro)
- [ ] Design system Human aplicado no `packages/ui`:
  - tokens de cor do tema escuro, degradês, raios e rótulos;
  - fontes Inter (interface), Sora (documentos) e mono (minutos);
  - componentes base: sidebar, card, busca, toggle segmentado, pílula, rótulo.

**Aceite:** login funciona e uma gravação vazia aparece na lista com status.

## M1 — Pipeline com importação (prova de valor)
- [ ] Upload de áudio/vídeo na web (mp3, m4a, wav, mp4, webm, opus)
- [ ] Extração de áudio de vídeo (ffmpeg no worker)
- [ ] Transcrição com diarização em pt-BR
- [ ] Ata com modelo genérico + extração de decisões e pendências (JSON validado)
- [ ] Tela da gravação: player + transcrição sincronizada + ata

**Aceite:** subir a gravação de uma reunião real de 1 h e ter ata e pendências corretas em menos de 5 min.

## M2 — Gravação presencial (celular)
- [ ] App Expo com gravação em segundo plano (tela bloqueada) por até 4 h
- [ ] Gravação em blocos de 30–60 s, salvos localmente e enviados de forma incremental
- [ ] Retomada após queda de rede ou fechamento do app; fila offline
- [ ] Indicador de gravação + lembrete de avisar participantes
- [ ] Marcar momento importante durante a gravação (vira destaque na ata)
- [ ] Importar gravação de chamada do iPhone / áudio do WhatsApp pelo menu Compartilhar

**Aceite:** reunião de obra de 2 h gravada com o celular bloqueado no bolso, sem perder nenhum trecho.

## M3 — Gravador desktop (reuniões online)
- [ ] App Tauri na barra de menu (macOS) / bandeja (Windows)
- [ ] Captura do áudio do sistema + microfone em **faixas separadas** ("eu" × "outros")
- [ ] Detecção de reunião em andamento (Meet, Teams, Zoom, WhatsApp) com sugestão de gravar
- [ ] Upload incremental igual ao mobile
- [ ] Fluxo de permissões guiado (macOS: gravação de áudio/tela; Windows: microfone)

**Aceite:** gravar uma reunião no Teams desktop e outra no Meet pelo navegador; ambas com "eu" e "outros" separados corretamente.

## M4 — Modelos de ata e saídas
- [ ] Modelos iniciais:
  - Reunião de obra
  - Visita técnica
  - Cliente
  - Fornecedor
  - Sócios/investidores
  - Genérico
- [ ] Sugestão automática do modelo + troca manual com regeneração
- [ ] Editor de modelos (seções, instruções, campos a extrair)
- [ ] Trechos da ata vinculados ao minuto do áudio
- [ ] PDF padrão **Executiva** (estilo Human, fonte Sora) conforme SPEC item 28; Formal e Painel como alternativas de exportação
- [ ] **Perfil e empresa** (SPEC item 27):
  - menu de perfil em todas as telas;
  - dados do usuário;
  - dados da empresa;
  - envio da logomarca (bucket próprio, versão clara opcional para cabeçalho escuro);
  - cor de destaque e modelo de PDF padrão;
  - prévia ao vivo do PDF.
- [ ] Exportar DOCX, texto para WhatsApp, envio por e-mail, link privado com expiração

**Aceite:** ata de reunião de obra sai em PDF A4 com a logo, os dados e a cor da empresa cadastrados no perfil, na fonte Sora, e é enviada por e-mail sem edição manual de layout.

## M5 — Biblioteca, busca e "Pergunte"
- [ ] Projetos/obras e filtros (pessoa, tipo, data)
- [ ] Busca textual + embeddings (pgvector) por trecho
- [ ] **Busca livre** (SPEC item 16):
  - interpretação do texto em tema + filtros (obra, participante, plataforma, período, tipo) usando o cadastro da empresa;
  - chips "Entendi assim" removíveis;
  - resultados agrupados por reunião, ordenados por menções, com até 3 trechos e minutos;
  - modos "por significado" e "palavra exata".
- [ ] "Pergunte" sobre uma gravação e sobre todas, sempre com citação (gravação + minuto)

**Aceite:**
- "concreto Galpão A com Marcos" mostra só as reuniões certas, com os trechos e minutos de cada menção.
- Perguntar "o que foi combinado sobre o prazo da estrutura do galpão?" traz a resposta com link para o trecho certo.

## M6 — Falantes e pessoas
- [ ] Renomear falantes com propagação para toda a gravação
- [ ] Cadastro de pessoas (nome, empresa, papel) e sugestão de nome em novas gravações
- [ ] Pendências atribuídas a pessoas cadastradas

**Aceite:** numa reunião recorrente, os falantes já vêm nomeados corretamente na maioria das vezes.

## M7 — Integrações
- [ ] Calendário Google / Outlook:
  - título da reunião
  - participantes
  - projeto
  - lembrete de gravar
- [ ] Envio de pendências ao ioo / sistemas de obra (webhook/API)
- [ ] Importação automática das gravações do Meet/Teams quando houver acesso (Drive / OneDrive)

**Aceite:** uma reunião do calendário gera, ao final, a ata vinculada ao projeto certo e as pendências no ioo.

## M8 — Bot de reunião (opcional)
- [ ] Integração com API de bot de reunião (ex.: Recall.ai) para Meet, Teams e Zoom
- [ ] Agendar o bot a partir do calendário
- [ ] Controle de custo por hora e liga/desliga por reunião

**Aceite:** o bot entra numa reunião em que o usuário não está no computador e a ata chega normalmente.
