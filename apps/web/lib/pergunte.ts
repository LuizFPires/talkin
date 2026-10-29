import { PERGUNTE_SYSTEM_PROMPT, buildPerguntePrompt, type TrechoContexto } from '@talkin/core';

/** Vetor → literal pgvector '[...]' aceito pela RPC. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

/** Chama o Claude para responder com base só nos trechos; sem chave, usa fallback citado. */
export async function responderPergunta(
  pergunta: string,
  trechos: TrechoContexto[],
): Promise<string> {
  if (trechos.length === 0) return 'Não encontrei isso nas gravações.';

  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) {
    // Modo só-código: devolve o trecho mais relevante já com a citação exigida.
    const t = trechos[0]!;
    return `${t.text} [rec:${t.recordingId} ms:${t.startMs}]`;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5',
      max_tokens: 1024,
      system: PERGUNTE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPerguntePrompt(pergunta, trechos) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (json.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
}
