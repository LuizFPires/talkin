# PRD — Talkin

> Gravador inteligente de reuniões, inspirado no Plaud Note: grava reuniões presenciais e online (Google Meet, Teams, Zoom, WhatsApp desktop, qualquer plataforma), transcreve com identificação de quem falou e gera a ata no modelo certo para cada tipo de reunião.

---

## 1. Problema

Muitas reuniões acontecem todo dia: obra, cliente, fornecedor, sócios. Elas são presenciais, por Meet ou por Teams. O que foi combinado se perde. Prazos prometidos, valores negociados e pendências ficam só na memória de quem estava lá.

O Plaud resolve parte disso, mas tem três limitações:
- depende de um hardware e de uma assinatura;
- usa modelos de resumo genéricos;
- não se integra aos sistemas da empresa (obras, pendências, ioo).

## 2. Objetivo

Toda conversa importante vira, em minutos, um registro **pesquisável** e **acionável**:
- transcrição com falantes;
- ata no modelo do tipo de reunião;
- decisões, pendências com responsável e prazo;
- possibilidade de perguntar sobre qualquer gravação passada.

## 3. Usuários

| Perfil | Uso principal |
|---|---|
| Diretor / gestor | Reuniões com clientes, sócios, investidores; online e presenciais |
| Engenheiro de obra | Reuniões de obra, visitas técnicas, alinhamento com empreiteiros |
| Comercial / suprimentos | Negociações com fornecedores |

## 4. Escopo funcional

### 4.1 Captura
1. **Presencial (celular):** app nativo (iOS/Android) que grava com a tela bloqueada, por várias horas, salvando em blocos para não perder áudio se o app fechar ou a internet cair.
2. **Online (computador):** gravador de desktop (macOS e Windows) que captura **o áudio do sistema + o microfone**. Por isso funciona com qualquer plataforma: Meet, Teams, Zoom, WhatsApp, Webex, chamada no navegador ou app nativo, sem precisar de bot na reunião.
3. **Importação:** upload de áudio ou vídeo já gravado (gravação do Meet/Teams, áudio de WhatsApp, gravador comum, gravação de chamada do iPhone).
4. **Indicador visível de gravação** sempre ativo, e lembrete de avisar os participantes (LGPD).

### 4.2 Processamento
1. Transcrição em pt-BR com **separação de falantes** (diarização).
2. Na captura online, as faixas "eu" (microfone) e "outros" (sistema) são separadas, o que melhora a identificação.
3. Nomeação dos falantes. Fonte: convidados do calendário + correção manual + memória de nomes já usados.
4. Geração da **ata por modelo**, com escolha automática sugerida e troca manual. Modelos iniciais:
   - Reunião de obra
   - Visita técnica
   - Reunião com cliente
   - Negociação com fornecedor
   - Reunião de sócios / investidores
   - Genérico
5. Extração estruturada dos seguintes itens:

| Item | Campos |
|---|---|
| Decisões | — |
| Pendências | responsável, prazo |
| Valores citados | formato brasileiro (R$ 1.234,56) |
| Datas e prazos | — |
| Riscos | — |

6. Trechos da ata **vinculados ao ponto do áudio**: clicar numa frase toca o momento exato.

### 4.3 Biblioteca
1. Lista de gravações com filtros por projeto/obra, pessoa, tipo e data.
2. **Busca livre** num campo só: o usuário escreve do jeito que quiser ("concreto Galpão A com Marcos em outubro") e o sistema separa tema, obra, participante, plataforma e período. O resultado lista todas as reuniões em que o tema apareceu, com os trechos e minutos. Modos: por significado (padrão) ou palavra exata.
3. **"Pergunte"**: chat sobre uma gravação ou sobre todas. Toda resposta cita a gravação e o minuto de onde veio a informação.
4. Pastas por projeto/obra.

### 4.4 Saída e compartilhamento
- Exportar ata em PDF e DOCX. PDF padrão: modelo **Executiva**, estilo Human, fonte **Sora** (alternativas: Formal e Painel).
- Link privado de compartilhamento.
- Envio por e-mail.
- Texto pronto para colar no WhatsApp.
- Pendências exportáveis (fase posterior: enviadas ao ioo / sistemas de obra).

### 4.5 Perfil e empresa
- Menu de perfil acessível em todas as telas (rodapé da barra lateral na web, engrenagem no celular).
- O próprio usuário cadastra seus dados (nome, cargo, contato, assinatura).
- O administrador cadastra os dados da empresa e **sobe a logomarca**:
  - nome fantasia, razão social, CNPJ, endereço, telefone, site;
  - cor de destaque;
  - modelo de PDF padrão.
- Prévia ao vivo da ata em PDF com a logo e os dados.

### 4.6 Identidade visual
- **Interface:** design system **Human (AI Video Lab · Human Academy)**. Tema escuro com tinta de teal, acento único verde-menta, painéis em degradê vertical, raios grandes e rótulos em caixa alta com tracking.
- **Documentos:** PDF da ata na fonte **Sora**.
- **Referências:**
  - design system no artefato "AI Video Lab · Human Academy" e na pasta `@Design Systems/Design System Human`;
  - protótipo navegável com todas as telas: https://claude.ai/artifact/CfvBRa7Y2gNsZeTiYZDrKg

## 5. Fora do escopo da v1
- Hardware próprio (gravador físico).
- Gravação de **ligação telefônica comum** pelo app (o iOS bloqueia; a saída é importar a gravação nativa do iPhone).
- Bot que entra na reunião sozinho (planejado como milestone opcional).
- Tradução simultânea.

## 6. Decisão de arquitetura — como capturar reuniões online

| Opção | Funciona com | Prós | Contras |
|---|---|---|---|
| **A. Gravador desktop (áudio do sistema + mic)** | Qualquer plataforma, web ou app | Sem bot visível, sem integração por plataforma, custo zero por hora | Precisa estar no computador; exige permissão de captura de áudio no SO |
| B. Bot na reunião (API tipo Recall.ai) | Meet, Teams, Zoom, Webex | Não precisa estar no computador; nomes dos falantes vêm da plataforma | Custo por hora; bot aparece como participante; não cobre WhatsApp e afins |
| C. Extensão do Chrome (áudio da aba) | Plataformas no navegador | Simples | Não pega o app desktop do Teams/Zoom |
| D. Transcrição nativa (APIs Google/Microsoft) | Meet (Workspace) / Teams (M365) | Já vem pronta | Depende de licença e configuração do tenant; não serve para reunião de terceiros |

**Decisão:** A é a captura principal online, o celular cobre o presencial e a importação cobre o resto. B entra como opcional depois.

## 7. Requisitos não funcionais

| Tema | Requisito |
|---|---|
| Idioma | pt-BR em toda a interface e nos prompts; números e moeda no padrão brasileiro |
| Duração | gravações de até 4 h |
| Tempo de processamento | ata pronta em até 5 min após o fim de uma reunião de 1 h |
| Resiliência | gravação em blocos com upload incremental; nada se perde se cair a rede ou fechar o app |
| Segurança | áudio e transcrição são dados sensíveis: criptografia em repouso, acesso por usuário/empresa, links de compartilhamento com expiração |
| LGPD | aviso de gravação, política de retenção configurável, exclusão definitiva sob pedido |
| Custos | transcrição + IA monitorados por gravação; meta de custo bem abaixo da assinatura do Plaud |

## 8. Métricas de sucesso
- % de reuniões relevantes gravadas (meta: maioria das reuniões de obra e de cliente).
- % de pendências da ata que o usuário mantém sem editar.
- Tempo entre o fim da reunião e a ata enviada.
- Uso do "Pergunte" por semana.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Qualidade do áudio em obra (ruído) | Recomendar microfone de lapela; filtro de ruído antes da transcrição |
| Permissões de captura no macOS/Windows mudam com atualizações | Isolar a captura num módulo nativo pequeno e testável |
| Diarização erra quando há muitas pessoas na sala | Correção manual rápida + memória de vozes/nomes |
| Gravação sem consentimento | Indicador permanente, lembrete de aviso, registro de quem gravou |
