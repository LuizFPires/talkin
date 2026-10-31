import { readFile } from 'node:fs/promises';
import type {
  TranscribeInput,
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptSegment,
} from '@talkin/core';

type DeepgramWord = {
  word: string;
  start: number; // segundos
  end: number;
  speaker?: number;
  punctuated_word?: string;
};

/** Transcrição via Deepgram (nova-2, pt-BR, diarização). */
export class DeepgramProvider implements TranscriptionProvider {
  readonly name = 'deepgram';
  // nova-2 ≈ US$0,0043/min = 0,43 centavo/min (o valor antigo, 43, estava 100× maior).
  private readonly centsPerMinute = 0.43;

  constructor(private readonly apiKey: string) {}

  async transcribe(input: TranscribeInput): Promise<TranscriptionResult> {
    const audio = await readFile(input.audioPath);
    const params = new URLSearchParams({
      model: 'nova-2',
      language: input.language ?? 'pt-BR',
      diarize: 'true',
      punctuate: 'true',
      smart_format: 'true',
    });
    if (input.vocabulary?.length) {
      for (const term of input.vocabulary) params.append('keywords', term);
    }

    const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: 'POST',
      headers: { Authorization: `Token ${this.apiKey}`, 'Content-Type': 'audio/*' },
      body: new Uint8Array(audio),
    });
    if (!res.ok) {
      throw new Error(`Deepgram ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      metadata?: { duration?: number };
      results?: {
        channels?: { alternatives?: { words?: DeepgramWord[] }[] }[];
      };
    };

    const words = json.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
    const segments = agruparPalavras(words);
    const durationMin = (json.metadata?.duration ?? 0) / 60;

    return {
      language: input.language ?? 'pt-BR',
      provider: this.name,
      segments,
      costCents: Math.round(durationMin * this.centsPerMinute),
    };
  }
}

const PAUSA_MS = 1200; // silêncio que fecha um trecho
const TRECHO_ALVO_MS = 8000; // a partir daqui, fecha na próxima pontuação final
const TRECHO_MAX_MS = 25000; // nunca passa disso, mesmo sem pontuação
const FIM_DE_FRASE = /[.!?…]["»)]?$/;

/**
 * Agrupa palavras em trechos curtos e citáveis: quebra quando muda o falante,
 * quando há pausa, ou — a partir de ~8 s — na próxima pontuação final (teto de
 * 25 s). Um monólogo de 78 s vira ~10 trechos com minuto próprio, em vez de um
 * bloco só (o que acontecia antes e inviabilizava citações e busca).
 */
export function agruparPalavras(words: DeepgramWord[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let atual: TranscriptSegment | null = null;
  let fimAnteriorMs = 0;

  for (const w of words) {
    const label = `Falante ${(w.speaker ?? 0) + 1}`;
    const token = w.punctuated_word ?? w.word;
    const startMs = Math.round(w.start * 1000);
    const endMs = Math.round(w.end * 1000);
    const trocouFalante = atual !== null && atual.speakerLabel !== label;
    const pausa = atual !== null && startMs - fimAnteriorMs > PAUSA_MS;
    const estouraria = atual !== null && endMs - atual.startMs > TRECHO_MAX_MS;
    if (!atual || trocouFalante || pausa || estouraria) {
      if (atual) segments.push(atual);
      atual = { speakerLabel: label, track: 'desconhecido', startMs, endMs, text: token };
    } else {
      atual.endMs = endMs;
      atual.text += ` ${token}`;
    }
    fimAnteriorMs = endMs;
    const duracao = atual.endMs - atual.startMs;
    if (duracao >= TRECHO_ALVO_MS && FIM_DE_FRASE.test(token)) {
      segments.push(atual);
      atual = null;
    }
  }
  if (atual) segments.push(atual);
  return segments;
}
