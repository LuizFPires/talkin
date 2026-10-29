import type { AtaContent, AtaInput, TranscriptionResult } from '@talkin/core';

/**
 * Portas que o orquestrador usa para falar com o mundo (DB, storage, ffmpeg).
 * O worker real liga isto ao Supabase; os testes usam uma versão em memória.
 */
export interface PipelinePorts {
  setStatus(recordingId: string, status: string): Promise<void>;
  upsertJob(
    recordingId: string,
    step: string,
    status: 'pending' | 'running' | 'done' | 'error',
    error?: string,
  ): Promise<void>;

  /** Concatena os blocos e normaliza o áudio; devolve o caminho local. */
  prepareAudio(recordingId: string): Promise<string>;

  saveTranscript(
    recordingId: string,
    result: TranscriptionResult,
  ): Promise<{ transcriptId: string; speakerIdByLabel: Record<string, string> }>;

  getTemplate(
    recordingId: string,
  ): Promise<{ templateId: string | null; key: string; sections: AtaInput['templateSections'] }>;

  getContext(recordingId: string): Promise<AtaInput['context']>;

  saveSummary(recordingId: string, templateId: string | null, content: AtaContent): Promise<string>;

  saveActionItems(recordingId: string, summaryId: string, content: AtaContent): Promise<void>;

  addCost(
    recordingId: string,
    cost: { transcriptionCents: number; aiCents: number },
  ): Promise<void>;
}

export type Providers = {
  transcription: import('@talkin/core').TranscriptionProvider;
  ata: import('@talkin/core').AtaProvider;
};
