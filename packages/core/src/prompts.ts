import type { AtaInput } from './providers';

/** Instrução de sistema para a ata — fidelidade total, nada inventado (SPEC 10). */
export const ATA_SYSTEM_PROMPT = `Você redige atas de reunião em português do Brasil a partir da transcrição com falantes e tempos.
Regras invioláveis:
- Fidelidade: não invente. Se algo não foi dito, não entra. Na dúvida, escreva "não ficou definido".
- No TEXTO (resumo, body) use o formato brasileiro: R$ 1.234,56 e datas dd/mm/aaaa.
- Nos CAMPOS do JSON, porém: datas ("prazo", "data") em ISO "AAAA-MM-DD"; "valor" é número puro (ponto decimal, sem separador de milhar, sem símbolo) e o símbolo/unidade vai em "unidade" (R$, R$/m³, m², dias). Converta prazos relativos em data quando possível.
- Cada frase da ata deve referenciar o(s) minuto(s) de origem (em ms) nos campos "minutos_ms"/"minuto_ms".
- Responsável não identificado em pendência: deixe "responsavel" nulo (será marcado "sem responsável").
- Prazo vago ("logo", "semana que vem"): estime uma data e marque "prazo_estimado": true.
Responda SOMENTE com JSON válido no formato pedido, sem texto fora do JSON.`;

/** Monta o prompt do usuário com a transcrição e o modelo escolhido. */
export function buildAtaUserPrompt(input: AtaInput): string {
  const linhas = input.segments
    .map((s) => `[${s.startMs}] ${s.speakerLabel}: ${s.text}`)
    .join('\n');
  const secoes = input.templateSections
    .map((s) => `- ${s.key} (${s.title})${s.instructions ? `: ${s.instructions}` : ''}`)
    .join('\n');
  const ctx = input.context;
  const contexto = [
    ctx?.projectName ? `Projeto/obra: ${ctx.projectName}` : null,
    ctx?.participants?.length ? `Participantes: ${ctx.participants.join(', ')}` : null,
    ctx?.vocabulary?.length ? `Glossário: ${ctx.vocabulary.join(', ')}` : null,
    input.highlights?.length ? `Destaques (ms): ${input.highlights.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `Modelo de ata: ${input.templateKey}
Seções a preencher:
${secoes}

${contexto ? `Contexto:\n${contexto}\n` : ''}
Transcrição (cada linha começa com o minuto em ms):
${linhas}

Gere o JSON com { resumo, secoes[{key,title,body,minutos_ms[]}], extracao{decisoes,pendencias,valores,prazos,riscos} }.`;
}

/** "Pergunte" (SPEC 17): responde só com base nas gravações e SEMPRE cita. */
export const PERGUNTE_SYSTEM_PROMPT = `Você responde perguntas sobre reuniões, em português do Brasil, usando SOMENTE os trechos fornecidos.
Regras invioláveis:
- Sem fonte não há resposta: se os trechos não contêm a informação, diga "Não encontrei isso nas gravações." e nada mais.
- Nunca invente. Não use conhecimento externo.
- Toda afirmação cita a origem: adicione referências [rec:<recordingId> ms:<minuto_ms>] ao final das frases que as usam.
- Formato brasileiro: R$ 1.234,56 e datas dd/mm/aaaa.`;

export type TrechoContexto = {
  recordingId: string;
  recordingTitle: string;
  startMs: number;
  text: string;
};

/** Monta o prompt do usuário com a pergunta e os trechos recuperados. */
export function buildPerguntePrompt(pergunta: string, trechos: TrechoContexto[]): string {
  const ctx = trechos
    .map((t) => `[rec:${t.recordingId} ms:${t.startMs}] (${t.recordingTitle}) ${t.text}`)
    .join('\n');
  return `Pergunta: ${pergunta}

Trechos disponíveis:
${ctx || '(nenhum trecho)'}

Responda com base apenas nos trechos acima, citando [rec:… ms:…].`;
}
