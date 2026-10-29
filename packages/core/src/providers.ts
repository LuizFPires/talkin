import type { AtaContent } from './extraction';

/** Trecho cru vindo da transcrição. */
export type TranscriptSegment = {
  speakerLabel: string; // "Falante 1", "Eu", "Outros"…
  track: 'eu' | 'outros' | 'desconhecido';
  startMs: number;
  endMs: number;
  text: string;
};

export type TranscriptionResult = {
  language: string;
  provider: string;
  segments: TranscriptSegment[];
  costCents: number;
};

export type TranscribeInput = {
  /** Caminho local do áudio já concatenado/normalizado. */
  audioPath: string;
  language?: string;
  /** Glossário da empresa (nomes de obras, termos técnicos). */
  vocabulary?: string[];
};

/** Serviço de transcrição com diarização (Deepgram, AssemblyAI, mock). */
export interface TranscriptionProvider {
  readonly name: string;
  transcribe(input: TranscribeInput): Promise<TranscriptionResult>;
}

export type AtaInput = {
  templateKey: string;
  templateSections: { key: string; title: string; instructions?: string }[];
  segments: TranscriptSegment[];
  /** Destaques marcados (minuto em ms). */
  highlights?: number[];
  context?: {
    projectName?: string;
    participants?: string[];
    vocabulary?: string[];
  };
};

export type AtaResult = {
  content: AtaContent;
  costCents: number;
};

/** Geração da ata + extração estruturada (Claude, mock). */
export interface AtaProvider {
  readonly name: string;
  generate(input: AtaInput): Promise<AtaResult>;
}
