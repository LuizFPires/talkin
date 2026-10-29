# SPEC — Talkin

Especificação funcional detalhada. Complementa o `PRD.md` (o quê e por quê) e o `PLAN.md` (quando).

Cada funcionalidade é descrita em seis blocos:
- **o que é**
- **onde aparece**
- **como funciona**
- **regras**
- **erros e casos-limite**
- **aceite**

A referência entre colchetes indica o milestone, por exemplo [M2].

---

## Sumário

**A. Captura**
1. Gravação presencial (celular)
2. Gravação de reuniões online (computador)
3. Detecção de reunião e agenda
4. Importação de áudio e vídeo
5. Marcar momento
6. Aviso de gravação e consentimento

**B. Processamento**

7. Transcrição
8. Falantes: separação e nomes
9. Modelos de ata
10. Geração da ata
11. Extração estruturada (decisões, pendências, valores, prazos, riscos)

**C. Consulta e uso**

12. Tela da ata e player vinculado
13. Transcrição navegável
14. Pendências
15. Biblioteca e projetos
16. Busca livre
17. Pergunte

**D. Saída e integrações**

18. Compartilhar e exportar
19. Notificações
20. Agenda (Google / Outlook)
21. Integração com o ioo e sistemas de obra
22. Bot de reunião (opcional)

**E. Plataforma**

23. Contas, empresa e permissões
24. Privacidade, retenção e LGPD
25. Controle de custos
26. Configurações
27. Perfil e empresa

**F. Identidade visual**

28. Design system e PDF padrão

---

# A. Captura

## 1. Gravação presencial (celular) [M2]

**O que é:** gravar reuniões presenciais (obra, escritório, visita técnica) com o celular, de forma confiável, mesmo com a tela bloqueada.

**Onde aparece:** botão vermelho central da biblioteca → tela "Gravando" (protótipo: Celular).

**Como funciona**
1. O usuário toca em **Gravar**.
2. Pode escolher o modelo da ata antes ou durante a gravação. O padrão é a sugestão automática.
3. A tela mostra os seguintes controles:

| Controle | Função |
|---|---|
| Cronômetro | tempo decorrido da gravação |
| Onda sonora | mostra que o microfone está captando |
| Indicador "Gravando" | estado atual da gravação |
| Marcar momento | destaca um trecho na ata (item 5) |
| Pausar / Retomar | interrompe e retoma a captura |
| Parar | encerra e envia para processamento |

4. O áudio é gravado em **blocos de 30 a 60 segundos**. Cada bloco é salvo no aparelho e enviado assim que houver internet.
5. Ao **Parar**, o app finaliza o último bloco, confirma que todos chegaram ao servidor e dispara o processamento (tela "Preparando a ata").
6. O usuário pode minimizar a tela. Uma barra fixa "Gravando 00:42" aparece no topo da biblioteca, e o sistema mostra a notificação de gravação ativa.

**Regras**

| Tema | Regra |
|---|---|
| Duração | até 4 h por gravação; aos 3h45 aparece um aviso; ao atingir 4 h, encerra e abre outra gravação automaticamente, vinculada à primeira |
| Formato | AAC/M4A mono, 32–48 kbps (voz), cerca de 15–20 MB por hora |
| Segundo plano | a gravação continua com a tela bloqueada e com o app em segundo plano |
| Interrupções | uma ligação telefônica pausa a gravação; ao fim da ligação, aparece "Retomar gravação?" |
| Espaço | abaixo de 500 MB livres, avisa antes de começar |

**Erros e casos-limite**
- **Sem internet:** grava normalmente, os blocos ficam numa fila e são enviados depois. Um ícone de nuvem pendente fica visível.
- **App fechado à força ou bateria acabando:** os blocos já salvos não se perdem. Ao reabrir, aparece "Gravação interrompida às 10:42 — enviar o que foi gravado?".
- **Permissão de microfone negada:** tela explicando como liberar, com atalho para os ajustes.
- **Ruído alto (obra):** aviso discreto "Áudio com muito ruído — aproxime o celular de quem fala", com sugestão de microfone de lapela.

**Aceite:** gravar 2 h com o celular bloqueado no bolso, alternando entre 4G e Wi-Fi, e o áudio chegar completo ao servidor.

---

## 2. Gravação de reuniões online (computador) [M3]

**O que é:** um app leve para Mac e Windows que grava qualquer reunião online sem bot. Ele captura o som do computador (os outros participantes) e o microfone (você).

**Onde aparece:** ícone na barra de menu (Mac) ou bandeja (Windows) → janela compacta (protótipo: Computador).

**Como funciona**
1. O app fica residente e mostra as próximas reuniões da agenda.
2. Quando uma reunião começa (item 3), sugere **Gravar esta reunião**, já com o título e o modelo de ata.
3. A captura usa **duas faixas separadas**:
   - **Eu:** microfone;
   - **Outros:** áudio do sistema.

   Isso garante que o que você disse nunca seja atribuído a outra pessoa.
4. Atalho de teclado global para iniciar e parar (ex.: ⌘⇧R / Ctrl+Shift+R).
5. Ao parar, mesmo fluxo do celular: os blocos são enviados e o processamento começa.

**Regras**
- **Plataformas:** funciona com qualquer app ou aba que emita som (Meet, Teams, Zoom, WhatsApp, Webex, Slack huddle, ligação pelo navegador).
- **Fones de ouvido:** como a captura é do sistema, funciona com fone com ou sem fio, sem eco.
- **Volume:** o áudio do sistema é capturado antes do controle de volume. Deixar a reunião no mudo não afeta a gravação; deixar o *app* da reunião no mudo afeta.
- **Mac:** exige a permissão de "Gravação de áudio do sistema". No primeiro uso, o app guia passo a passo.
- **Windows:** usa a captura de saída de áudio (loopback), sem permissão extra.

**Erros e casos-limite**
- **Dispositivo de saída trocado no meio** (ex.: conectou o fone): a captura acompanha a troca sem interromper.
- **Computador entrou em repouso:** a gravação pausa. Ao voltar, pergunta se deve retomar.
- **Mais de uma reunião aberta:** grava todo o som do sistema e avisa "Há áudio de outras fontes".
- **Música ou vídeo tocando junto:** entra na faixa "Outros". Recomendação na tela de fechar outras fontes.

**Aceite:** uma reunião no Teams desktop e outra no Meet pelo navegador, ambas com as faixas "Eu" e "Outros" corretas na transcrição.

---

## 3. Detecção de reunião e agenda [M3 + M7]

**O que é:** o app percebe que uma reunião começou e já sabe qual é, sem digitar nada.

**Como funciona**

As fontes de detecção, por ordem de prioridade:
1. evento da agenda em andamento com link de Meet, Teams ou Zoom;
2. app de reunião usando o microfone (Teams, Zoom, WhatsApp);
3. aba do navegador em meet.google.com, teams.microsoft.com etc.

Com isso, o app:
- preenche título, horário, participantes e projeto (pelo nome do evento ou por regra);
- sugere o modelo de ata (ex.: evento com fornecedor → "Negociação com fornecedor").

No celular, 2 minutos antes de uma reunião presencial da agenda, envia a notificação "Gravar 'Reunião de obra semanal'?".

**Regras**
- O usuário escolhe o comportamento da detecção:
  - **só sugerir** (padrão);
  - **gravar automaticamente** reuniões de certos calendários ou com certas palavras.
- A detecção nunca grava sozinha sem a opção automática ligada explicitamente.

**Aceite:** ao entrar numa reunião agendada, a sugestão aparece em até 10 s, com título e participantes corretos.

---

## 4. Importação de áudio e vídeo [M1]

**O que é:** trazer gravações feitas fora do app.

**Onde aparece:** botão **Importar** da biblioteca; menu Compartilhar do celular ("Enviar para Talkin"); arrastar arquivo na web.

**Fontes previstas**
- gravação do Meet ou Teams (MP4);
- áudio do WhatsApp (OPUS);
- gravação de chamada do iPhone;
- gravador de mão;
- vídeo de celular.

**Como funciona:** o usuário envia o arquivo e escolhe o modelo e o projeto (opcional). O sistema extrai o áudio do vídeo e segue o pipeline normal.

**Regras**

| Tema | Regra |
|---|---|
| Formatos | mp3, m4a, wav, aac, ogg/opus, webm, mp4, mov |
| Tamanho máximo | 2 GB ou 4 h por arquivo |
| Vários arquivos | 2 a 10 arquivos podem virar **uma única reunião** (partes 1, 2, 3) |
| Data da reunião | lida dos metadados do arquivo; se não existir, usa a data de envio, editável |

**Erros:** arquivo sem áudio, corrompido ou com idioma diferente de pt-BR (avisa e permite escolher outro idioma).

**Aceite:** importar o MP4 de uma reunião do Teams de 1 h e ter a ata em menos de 5 min.

---

## 5. Marcar momento [M2]

**O que é:** um toque durante a gravação para dizer "isto é importante".

**Como funciona**
1. Botão **Marcar momento** no celular, no computador e por atalho.
2. Cada marca guarda o instante e, opcionalmente, um rótulo rápido: Decisão, Pendência, Valor, Atenção.
3. Na ata, o trecho em volta da marca (±30 s) recebe prioridade e aparece numa seção **Destaques**.

**Aceite:** 3 momentos marcados viram 3 destaques na ata, cada um com o minuto certo.

---

## 6. Aviso de gravação e consentimento [M2]

**O que é:** proteção legal e de confiança. Ninguém é gravado sem saber.

**Como funciona**
- **Durante a gravação:** indicador permanente "Gravando" e lembrete no início: "Avise os participantes".
- **Em reuniões online** (opcional): o app oferece copiar uma mensagem padrão para o chat da reunião: "Esta reunião está sendo gravada para geração de ata."
- **Registro:** cada gravação guarda quem gravou, quando e de qual dispositivo.

**Regras:** não existe modo de gravação oculta. O indicador não pode ser desligado.

---

# B. Processamento

## 7. Transcrição [M1]

**O que é:** converter o áudio em texto em português, com pontuação e marcação de tempo.

**Como funciona**
1. Os blocos são unidos e o áudio é normalizado (volume e redução de ruído).
2. O áudio é enviado ao serviço de transcrição com:
   - separação de falantes;
   - idioma pt-BR;
   - **vocabulário personalizado da empresa** (nomes de obras, fornecedores, termos técnicos como fck, sapata, P12, armação, laje alveolar).
3. O resultado é dividido em **trechos** com falante, início, fim e texto.

**Regras**
- **Tempo:** reunião de 1 h transcrita em até 3 min.
- **Números:** valores e medidas são normalizados ("quinhentos e doze reais" → R$ 512,00; "oitenta e seis metros cúbicos" → 86 m³) **na ata**. A transcrição mantém o que foi dito.
- **Glossário:** cada empresa mantém o seu glossário (item 26). Correções feitas pelo usuário podem alimentá-lo.

**Erros e casos-limite**
- **Trechos inaudíveis:** marcados como [inaudível 00:12:40].
- **Falha do serviço:** até 3 novas tentativas. Se continuar falhando, a gravação fica "Com erro", com o botão **Reprocessar**.

---

## 8. Falantes: separação e nomes [M1 + M6]

**O que é:** saber quem disse o quê, com o nome real das pessoas.

**Como funciona**

| Situação | Como os falantes são separados |
|---|---|
| Presencial | a transcrição separa as vozes (Falante 1, 2, 3…) |
| Online | a faixa "Eu" já é você; a faixa "Outros" é separada por voz |

Os nomes vêm de três fontes:
- convidados da agenda (sugestão);
- vozes já reconhecidas em reuniões anteriores com as mesmas pessoas (sugestão);
- correção manual: tocar em "Falante 2" → escolher ou digitar o nome. A troca vale para a gravação inteira.

Também é possível **juntar** dois falantes (quando o sistema separou a mesma pessoa em dois) e **dividir** um trecho atribuído à pessoa errada.

**Regras**
- O cadastro de pessoas guarda nome, empresa, papel (ex.: "Júlio · Estrutura") e contato.
- A identificação por voz é **opcional por empresa** e exige consentimento, porque é dado biométrico.

**Aceite:** numa reunião recorrente, a maioria dos falantes já vem com o nome certo.

---

## 9. Modelos de ata [M4]

**O que é:** cada tipo de reunião gera uma ata com estrutura própria.

**Modelos iniciais e o que cada um destaca**

| Modelo | Seções |
|---|---|
| Reunião de obra | Resumo · Avanço e atrasos · Decisões · Pendências por responsável · Valores · Riscos · Próxima reunião |
| Visita técnica | Local · Observações · Não conformidades · Fotos citadas · Providências |
| Reunião com cliente | Objetivo · Pedidos do cliente · Compromissos assumidos · Próximos passos · Pontos sensíveis |
| Negociação com fornecedor | Escopo · Preços e condições · Prazos de entrega · Concessões de cada lado · Pendências · Quem fecha |
| Sócios / investidores | Pauta · Deliberações · Números apresentados · Pendências · Votações/consensos |
| Genérico | Resumo · Tópicos · Decisões · Pendências |

**Como funciona**
- **Escolha do modelo:** o sistema sugere com base no título da agenda, nos participantes e no conteúdo. O usuário troca a qualquer momento e a ata é **regerada**; a versão anterior fica no histórico.
- **Editor de modelos:** criar ou editar seções, instruções ("liste pendências sempre com responsável e data"), campos obrigatórios e tom (formal ou objetivo).
- **Modelo padrão:** pode ser definido por projeto, por calendário ou por participante.

**Aceite:** a mesma gravação gera atas diferentes e coerentes ao trocar entre "Reunião de obra" e "Genérico".

---

## 10. Geração da ata [M1 + M4]

**O que é:** o texto final da ata, escrito pela IA a partir da transcrição e do modelo.

**Como funciona**
1. A IA recebe:
   - transcrição com falantes e tempos;
   - modelo escolhido;
   - destaques marcados;
   - contexto (projeto, participantes, glossário).
2. Escreve cada seção. **Cada frase guarda o(s) trecho(s) de origem**, e é isso que permite clicar e ouvir.
3. Mostra a ata como **rascunho**. O usuário revisa, edita qualquer texto e marca como **Revisada**.

**Regras**
- **Fidelidade:** a IA não inventa. Se algo não foi dito, não entra. Na dúvida, escreve "não ficou definido".
- **Formato:** valores em R$ 1.234,56, datas dd/mm/aaaa, prazos relativos convertidos em data ("até quinta" → 30/10).
- **Edição:** edições do usuário são preservadas se a ata for regerada (só as seções não editadas mudam).
- **Tempo:** ata pronta em até 5 min após o fim de uma reunião de 1 h.

---

## 11. Extração estruturada [M1]

**O que é:** além do texto, a ata gera **dados** que podem ser filtrados, contados e enviados a outros sistemas.

| Item | Campos |
|---|---|
| Decisão | texto, minuto, quem decidiu (se dito) |
| Pendência | texto, responsável, prazo, minuto, status |
| Valor citado | descrição, valor, unidade (R$, R$/m³, m², dias), minuto |
| Prazo/data | evento, data, minuto |
| Risco | texto, minuto, gravidade sugerida |

**Regras**
- Toda extração passa por validação de formato. O que falha não é salvo e entra em "Revisar".
- **Responsável não identificado:** a pendência entra como "sem responsável", destacada para o usuário atribuir.
- **Prazo vago** ("logo", "semana que vem"): sugere uma data e marca como "estimado".

---

# C. Consulta e uso

## 12. Tela da ata e player vinculado [M1 + M4]

**Onde aparece:** ao abrir uma gravação (protótipo: tela "Reunião de obra semanal").

**Elementos**
- **Cabeçalho:**
  - título (editável), data, duração, origem (presencial/Meet/Teams);
  - modelo, com troca;
  - participantes;
  - projeto.
- **Abas:** Ata · Transcrição · Pergunte.
- **Botões de minuto** ao lado de cada decisão, pendência e valor: tocam o áudio exatamente ali.
- **Player fixo:** play/pausa, avanço de 15 s, velocidade (1×, 1,5×, 2×) e barra de progresso com as marcas de destaque.
- **Ações:** Enviar ata, PDF, Editar, Reprocessar, Excluir.

**Regras:** ao tocar um minuto, a aba Transcrição (se aberta) rola até o trecho e o destaca.

---

## 13. Transcrição navegável [M1]

**O que é:** o texto completo da reunião, organizado por fala.

**Como funciona**
- Cada bloco mostra falante (com cor), minuto e texto.
- Durante a reprodução, o trecho falado fica destacado e a tela acompanha.
- **Busca dentro da transcrição** com contagem de ocorrências.
- **Edição pontual:** corrigir uma palavra ou trocar o falante de um trecho.
- **Copiar trecho** com minuto, para colar no WhatsApp ou e-mail.

---

## 14. Pendências [M1 + M6 + M7]

**O que é:** o resultado mais acionável da reunião. Cada pendência é um item de tarefa.

**Onde aparece**
- na ata (seção Pendências);
- numa lista geral "Minhas pendências", com todas as reuniões;
- por projeto.

**Como funciona**
- Marcar como concluída, editar texto, trocar responsável ou mudar prazo.
- Filtrar por responsável, projeto, prazo vencido ou status.
- **Lembrete automático** ao responsável antes do prazo (se tiver contato cadastrado e a opção ligada).
- **Na próxima reunião do mesmo projeto,** a ata traz a seção "Pendências anteriores": o que foi resolvido e o que continua aberto, com base no que foi dito.

**Regras:** a pendência sempre mantém o link para o minuto em que foi combinada.

**Aceite:** uma pendência criada numa reunião aparece na lista geral e no projeto, e é marcada como resolvida na reunião seguinte quando alguém diz que foi feita.

---

## 15. Biblioteca e projetos [M1 + M5]

**Onde aparece:** tela inicial (protótipo: Biblioteca).

**Como funciona**
- **Lista:**
  - ordenada da mais recente;
  - agrupada por "Hoje", "Esta semana", "Este mês";
  - cada cartão mostra tipo, origem, título, duração, data e status.
- **Status das gravações:**

| Status | Significado |
|---|---|
| Gravando | captura em andamento |
| Enviando | blocos subindo para o servidor |
| Processando | transcrição e ata em geração |
| Ata pronta (N pendências) | concluída |
| Com erro | falhou; mostra o botão Reprocessar |

- **Filtros:** tipo, projeto/obra, pessoa, origem, período e "com pendências abertas".
- **Projetos/obras:** pastas que agrupam reuniões e pendências. Uma reunião pode ser movida entre projetos.
- **Ações em lote:** mover, exportar e excluir.

---

## 16. Busca livre [M5]

**O que é:** um único campo onde o usuário escreve do jeito que quiser e encontra todas as reuniões em que um assunto apareceu, já filtradas por obra, pessoa, plataforma ou período.

**Onde aparece:** topo da biblioteca na web e no celular.

**Como funciona**
1. O usuário digita em linguagem natural, por exemplo "concreto Galpão A com Marcos em outubro".
2. O sistema separa o texto em:

| Parte | Como é reconhecida | Exemplo |
|---|---|---|
| Obra / projeto | nomes de projetos cadastrados | Galpão A |
| Participante | pessoas cadastradas e participantes das reuniões | Marcos |
| Plataforma | Presencial, Meet, Teams, Zoom, WhatsApp… | Teams |
| Período | hoje, ontem, esta semana, mês, intervalo de datas | outubro |
| Tipo de reunião | modelos de ata | visita, cliente, negociação |
| **Tema** | tudo o que sobra, sem palavras vazias ("com", "de", "na"…) | concreto |

3. Logo abaixo do campo aparece **"Entendi assim"**, com um chip por filtro reconhecido (Tema, Obra, Participante, Plataforma, Período, Tipo). Cada chip pode ser removido com um clique.
4. Os resultados vêm **agrupados por reunião**:
   - ordenados pelo número de menções do tema;
   - cada reunião mostra título, obra, plataforma, data e participantes;
   - até 3 trechos com o minuto e a palavra destacada. Tocar abre a ata naquele ponto.
5. **Sem tema** (só filtros, ex.: "Rafael esta semana"): lista as reuniões que batem com os filtros.
6. **Modos de busca:**
   - **Por significado** (padrão): "concreto" também acha concretagem, fck, m³, concreteira; "atraso" acha "dois dias atrás do cronograma".
   - **Palavra exata:** só o termo digitado.

**Regras**
- O reconhecimento usa o cadastro real da empresa (obras, pessoas, plataformas). Nome ambíguo (ex.: "Ana" pessoa × palavra) prioriza a pessoa cadastrada e mostra o chip para o usuário corrigir.
- A busca respeita as permissões: só aparecem reuniões que o usuário pode ver.
- Reunião sem transcrição (erro de processamento) aparece só em buscas sem tema, com aviso para reprocessar.

**Aceite:** "concreto Galpão A com Marcos" mostra só as reuniões do Galpão A com o Marcos em que se falou de concreto, cada uma com seus trechos e minutos.

---

## 17. Pergunte [M5]

**O que é:** um chat que responde com base nas gravações.

**Onde aparece:** aba Pergunte da ata e botão Pergunte na biblioteca.

**Como funciona**
- **Escopo:** **Esta reunião** ou **Todas** (com filtros de projeto e período).
- **Exemplos:**
  - "O que o fornecedor prometeu sobre prazo de entrega?"
  - "Quanto foi orçado de hora extra em outubro?"
  - "Liste as pendências do Rafael em aberto."
- **Citações:** toda resposta traz botões com **gravação + minuto**. Tocar leva ao trecho.
- **Sugestões de perguntas** de acordo com o tipo de reunião.

**Regras**
- **Sem fonte, não responde:** se a informação não está nas gravações, diz isso claramente.
- **Respeita as permissões:** só usa reuniões que o usuário pode ver.

---

# D. Saída e integrações

## 18. Compartilhar e exportar [M4]

**Opções**

| Saída | Detalhe |
|---|---|
| PDF | layout padrão **Executiva** no estilo Human (cabeçalho escuro em degradê teal, acento menta, raios grandes) com a fonte **Sora**; logo, dados e cor da empresa vêm de Perfil e empresa (item 27) |
| DOCX | para edição no Word |
| E-mail | envia a ata aos participantes; o usuário revisa destinatários e texto antes |
| WhatsApp | texto resumido e formatado, pronto para colar |
| Link privado | página da ata com expiração (7, 30 dias ou sem expiração) e opção de incluir ou não o áudio |

**Regras**
- O áudio e a transcrição completa **não** vão por padrão. O usuário escolhe incluir.
- O envio por e-mail sempre pede confirmação.

---

## 19. Notificações [M2]

| Evento | Canal |
|---|---|
| Ata pronta | push no celular e no computador |
| Reunião da agenda começando | sugestão de gravar |
| Envio pendente (sem internet) | aviso discreto |
| Pendência perto do prazo | push / e-mail (opcional) |
| Erro no processamento | push com botão Reprocessar |

---

## 20. Agenda (Google / Outlook) [M7]

**Como funciona**
- O usuário conecta a agenda Google ou Microsoft (só leitura).
- Cada reunião gravada durante um evento herda título, participantes e descrição.
- **Regras automáticas,** por exemplo:
  - eventos com "obra" no título → modelo Reunião de obra;
  - eventos com o fornecedor X → projeto Y.
- **Importação das gravações oficiais** do Meet/Teams, quando a empresa grava pela própria plataforma (via Google Drive / OneDrive).

---

## 21. Integração com o ioo e sistemas de obra [M7]

**O que é:** levar decisões e pendências para onde a obra é gerida.

**Como funciona**
- **Ao marcar a ata como Revisada,** envia ao ioo:
  - as pendências (responsável, prazo, projeto, link do minuto);
  - as decisões.
- O ioo pode consultar o Talkin ("o que foi decidido na última reunião da obra X?").
- **Webhook genérico** para outros sistemas.

**Regras:** só ata revisada é enviada (evita espalhar erro da IA).

---

## 22. Bot de reunião (opcional) [M8]

**O que é:** para quando o usuário não está no computador ou quer gravar uma reunião em que nem vai entrar.

**Como funciona**
- O usuário agenda pelo evento da agenda: "enviar o Talkin para esta reunião".
- O bot entra como participante nomeado ("Talkin — gravador"), grava e sai ao final.
- Os nomes dos falantes vêm da própria plataforma.

**Regras**
- Custo por hora visível antes de ativar.
- Liga e desliga por reunião.
- Aviso automático no chat da reunião.

---

# E. Plataforma

## 23. Contas, empresa e permissões [M0]

- **Estrutura:** Empresa → usuários → projetos.
- **Papéis:**

| Papel | Pode |
|---|---|
| Administrador | tudo, incluindo modelos, integrações e retenção |
| Gestor | ver todas as reuniões dos projetos em que participa |
| Membro | ver as próprias gravações e as compartilhadas com ele |

- **Visibilidade de cada gravação:** privada (padrão), projeto ou empresa.
- **Login:** e-mail + código, ou Google/Microsoft.

---

## 24. Privacidade, retenção e LGPD [M0 + M4]

**Proteção dos dados**
- Áudio e texto criptografados em repouso e em trânsito.
- Áudio e transcrição **nunca** são usados para treinar modelos.

**Retenção, configurável por empresa**
- áudio: 90 dias, 1 ano ou para sempre;
- ata e pendências: mantidas mesmo após apagar o áudio.

**Exclusão**
- Excluir gravação vai para a lixeira por 30 dias; depois é definitiva.
- Pedido de exclusão de um participante: apagar todas as gravações em que ele aparece.

**Registro de acesso:** quem abriu, baixou ou compartilhou cada gravação.

---

## 25. Controle de custos [M1]

- Cada gravação registra o custo de transcrição e de IA.
- **Painel do administrador:**
  - custo por mês, por usuário e por projeto;
  - custo médio por hora gravada.
- **Limites opcionais:** horas por usuário por mês, com aviso ao chegar a 80%.

---

## 26. Configurações [M0 → M7]

| Configuração | Opções / conteúdo |
|---|---|
| Gravação | qualidade, redução de ruído, comportamento da detecção (sugerir / automático) |
| Modelos | lista, editor, modelo padrão por projeto/calendário |
| Glossário | termos técnicos, nomes de obras, fornecedores, siglas |
| Pessoas | cadastro com nome, empresa, papel e contato; identificação por voz (opcional) |
| Integrações | agenda, ioo, webhooks |
| Identidade visual da ata | logo, cores, rodapé (por empresa ou marca) |
| Notificações | o que avisar e por qual canal |
| Privacidade | retenção, visibilidade padrão, registro de acesso |

---

## 27. Perfil e empresa [M4]

**O que é:** menu de perfil (rodapé da barra lateral na web, engrenagem no celular) onde o próprio usuário configura seus dados e os da empresa.

**Como funciona**
- **Meu perfil:** nome, cargo, e-mail, telefone, foto e assinatura (usada no PDF quando houver campo de assinatura).
- **Empresa:**
  - envio da logomarca (PNG transparente, JPG, SVG ou WEBP, mínimo 600 px), com prévia em fundo claro e escuro e opção de enviar uma versão clara para o cabeçalho escuro;
  - nome fantasia, razão social, CNPJ, inscrição estadual, endereço, cidade/UF, telefone e site;
  - cor de destaque;
  - modelo do PDF (padrão: Executiva).
- **Prévia ao vivo** da primeira página do PDF com a logo e os dados preenchidos.

**Regras**
- Só administradores alteram os dados da empresa. Cada usuário altera o próprio perfil.
- Sem logo enviada, o PDF mostra o nome fantasia no lugar.
- Sem versão clara da logo, o cabeçalho escuro coloca a logo sobre uma faixa branca.

---

# F. Identidade visual

## 28. Design system e PDF padrão [M0 + M4]

**Design system:** a interface segue o design system **Human (AI Video Lab · Human Academy)**.

| Elemento | Padrão |
|---|---|
| Tema do app | escuro: fundo `#030707` (preto com tinta de teal), cards `#060606`, bordas opacas `#2b2b2b` |
| Acento | menta `#94efda`, uma ocorrência por região; nunca como fundo de área grande |
| Painéis | degradê vertical (a luz vem de cima): sidebar `#0f1c1d → #070f11`, item ativo `#283334 → #1b2728` |
| Rótulos | caixa alta, 11–12 px, peso 500, tracking `.18em`, cor `#798e91` |
| Raios | 24 px painéis, 16 px cards e busca, 12 px itens de menu, pílula em botões e toggles |
| Fonte da interface | Inter (padrão do design system); minutos e trechos técnicos em mono |
| Fonte dos documentos | **Sora** (escolhida para o PDF da ata) |

**PDF padrão da ata — modelo Executiva:**
- **Página 1:**
  - cabeçalho em degradê teal (`#071416 → #172a2b`) com logomarca, número da ata, selo "Revisada" em menta, título e metadados;
  - quatro números da reunião em cartões (o de destaque em painel escuro com número em menta);
  - resumo, participantes, decisões e pendências.
- **Página 2 em diante:**
  - avanço e atrasos;
  - valores citados, com total calculado em pílula escura;
  - linha do tempo das próximas datas;
  - riscos;
  - pendências da reunião anterior;
  - destaques marcados.
- **Padrões visuais:**
  - minutos do áudio sempre em pílula mono;
  - responsáveis em pílula;
  - rótulos de seção em caixa alta com tracking.
- **Rodapé:** dados da empresa (item 27), paginação e nota de que a ata foi gerada a partir da gravação.
- **Alternativas mantidas como opção de exportação:** Formal (estilo ata oficial, com assinaturas) e Painel (coluna lateral).

**Aceite:** a ata de uma reunião real exporta em PDF A4 com a logo, os dados e a cor da empresa, na fonte Sora, sem quebra de seção órfã no fim da página.
