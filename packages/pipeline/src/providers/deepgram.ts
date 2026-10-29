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
  private readonly centsPerMinute = 43; // ~US$0,0043/min nova-2 → ajustar conforme contrato

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
    const segments = groupWordsBySpeaker(words);
    const durationMin = (json.metadata?.duration ?? 0) / 60;

    return {
      language: input.language ?? 'pt-BR',
      provider: this.name,
      segments,
      costCents: Math.round(durationMin * this.centsPerMinute),
    };
  }
}

/** Agrupa palavras consecutivas do mesmo falante em um trecho. */
function groupWordsBySpeaker(words: DeepgramWord[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;

  for (const w of words) {
    const label = `Falante ${(w.speaker ?? 0) + 1}`;
    const token = w.punctuated_word ?? w.word;
    if (!current || current.speakerLabel !== label) {
      if (current) segments.push(current);
      current = {
        speakerLabel: label,
        track: 'desconhecido',
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
        text: token,
      };
    } else {
      current.endMs = Math.round(w.end * 1000);
      current.text += ` ${token}`;
    }
  }
  if (current) segments.push(current);
  return segments;
}
