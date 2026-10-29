import { z } from 'zod';

/** Papéis dentro da empresa (SPEC 23). */
export const Role = z.enum(['admin', 'gestor', 'membro']);
export type Role = z.infer<typeof Role>;

/** Visibilidade de cada gravação (SPEC 23). Padrão: privada. */
export const Visibility = z.enum(['privada', 'projeto', 'empresa']);
export type Visibility = z.infer<typeof Visibility>;

/**
 * Status de uma gravação. Inclui as etapas do pipeline para que
 * `recordings.status` reflita cada etapa (ver CLAUDE.md › Pipeline).
 */
export const RecordingStatus = z.enum([
  'gravando',
  'enviando',
  'transcrevendo',
  'segmentando',
  'resumindo',
  'extraindo',
  'pronto',
  'erro',
]);
export type RecordingStatus = z.infer<typeof RecordingStatus>;

/** Rótulo coarse mostrado na biblioteca (SPEC 15). */
export const LibraryStatus = z.enum([
  'gravando',
  'enviando',
  'processando',
  'pronto',
  'erro',
]);
export type LibraryStatus = z.infer<typeof LibraryStatus>;

const PROCESSING: ReadonlySet<RecordingStatus> = new Set([
  'transcrevendo',
  'segmentando',
  'resumindo',
  'extraindo',
]);

/** Converte o status detalhado no rótulo da biblioteca. */
export function toLibraryStatus(status: RecordingStatus): LibraryStatus {
  if (status === 'gravando') return 'gravando';
  if (status === 'enviando') return 'enviando';
  if (status === 'pronto') return 'pronto';
  if (status === 'erro') return 'erro';
  if (PROCESSING.has(status)) return 'processando';
  return 'processando';
}

/** Origem da gravação. */
export const RecordingSource = z.enum([
  'presencial',
  'meet',
  'teams',
  'zoom',
  'whatsapp',
  'importado',
  'outro',
]);
export type RecordingSource = z.infer<typeof RecordingSource>;

/** Etapas reprocessáveis do pipeline (tabela processing_jobs). */
export const JobStep = z.enum([
  'normalize',
  'transcribe',
  'segment',
  'summarize',
  'extract',
  'embed',
]);
export type JobStep = z.infer<typeof JobStep>;

export const JobStatus = z.enum(['pending', 'running', 'done', 'error']);
export type JobStatus = z.infer<typeof JobStatus>;

/** Status da ata/resumo. */
export const SummaryStatus = z.enum(['rascunho', 'revisada']);
export type SummaryStatus = z.infer<typeof SummaryStatus>;

/** Status de uma pendência. */
export const ActionItemStatus = z.enum(['aberta', 'concluida']);
export type ActionItemStatus = z.infer<typeof ActionItemStatus>;

/** Política de retenção de áudio por empresa (SPEC 24). */
export const AudioRetention = z.enum(['90d', '1y', 'forever']);
export type AudioRetention = z.infer<typeof AudioRetention>;

/** Modelo de PDF da ata (SPEC 28). */
export const PdfTemplate = z.enum(['executiva', 'formal', 'painel']);
export type PdfTemplate = z.infer<typeof PdfTemplate>;
