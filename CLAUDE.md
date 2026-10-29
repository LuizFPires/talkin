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
