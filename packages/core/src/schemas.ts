import { z } from 'zod';
import {
  ActionItemStatus,
  AudioRetention,
  JobStatus,
  JobStep,
  PdfTemplate,
  RecordingSource,
  RecordingStatus,
  Role,
  SummaryStatus,
  Visibility,
} from './enums';

const uuid = z.string().uuid();
const ts = z.string().datetime({ offset: true });
const tsNullable = ts.nullable();

/** Empresa (SPEC 23 e 27). */
export const Organization = z.object({
  id: uuid,
  nome_fantasia: z.string().min(1),
  razao_social: z.string().nullable(),
  cnpj: z.string().nullable(),
  inscricao_estadual: z.string().nullable(),
  endereco: z.string().nullable(),
  cidade: z.string().nullable(),
  uf: z.string().length(2).nullable(),
  telefone: z.string().nullable(),
  site: z.string().nullable(),
  logo_url: z.string().nullable(),
  logo_light_url: z.string().nullable(),
  accent_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  pdf_template: PdfTemplate.default('executiva'),
  audio_retention: AudioRetention.default('1y'),
  created_at: ts,
});
export type Organization = z.infer<typeof Organization>;

/** Usuário (SPEC 27). O id é o do auth.users. */
export const Profile = z.object({
  id: uuid,
  organization_id: uuid,
  full_name: z.string().nullable(),
  cargo: z.string().nullable(),
  email: z.string().email(),
  telefone: z.string().nullable(),
  photo_url: z.string().nullable(),
  signature_url: z.string().nullable(),
  created_at: ts,
});
export type Profile = z.infer<typeof Profile>;

/** Vínculo usuário × empresa com papel (base da RLS). */
export const Membership = z.object({
  id: uuid,
  organization_id: uuid,
  user_id: uuid,
  role: Role,
  created_at: ts,
});
export type Membership = z.infer<typeof Membership>;

/** Projeto/obra. */
export const Project = z.object({
  id: uuid,
  organization_id: uuid,
  name: z.string().min(1),
  created_at: ts,
  deleted_at: tsNullable,
});
export type Project = z.infer<typeof Project>;

/** Gravação. */
export const Recording = z.object({
  id: uuid,
  organization_id: uuid,
  project_id: uuid.nullable(),
  created_by: uuid,
  title: z.string(),
  source: RecordingSource,
  status: RecordingStatus,
  visibility: Visibility.default('privada'),
  duration_s: z.number().int().nonnegative().nullable(),
  recorded_at: tsNullable,
  template_id: uuid.nullable(),
  cost_transcription_cents: z.number().int().nonnegative().default(0),
  cost_ai_cents: z.number().int().nonnegative().default(0),
  error: z.string().nullable(),
  created_at: ts,
  deleted_at: tsNullable,
});
export type Recording = z.infer<typeof Recording>;

/** Bloco de áudio (upload incremental). */
export const RecordingChunk = z.object({
  id: uuid,
  recording_id: uuid,
  index: z.number().int().nonnegative(),
  storage_path: z.string(),
  duration_s: z.number().nonnegative().nullable(),
  bytes: z.number().int().nonnegative().nullable(),
  uploaded_at: tsNullable,
  created_at: ts,
});
export type RecordingChunk = z.infer<typeof RecordingChunk>;

/** Transcrição. */
export const Transcript = z.object({
  id: uuid,
  recording_id: uuid,
  language: z.string().default('pt-BR'),
  provider: z.string().nullable(),
  created_at: ts,
});
export type Transcript = z.infer<typeof Transcript>;

/** Falante identificado numa gravação. */
export const Speaker = z.object({
  id: uuid,
  recording_id: uuid,
  label: z.string(),
  person_id: uuid.nullable(),
  display_name: z.string().nullable(),
  track: z.enum(['eu', 'outros', 'desconhecido']).default('desconhecido'),
  created_at: ts,
});
export type Speaker = z.infer<typeof Speaker>;

/** Trecho da transcrição. */
export const Segment = z.object({
  id: uuid,
  transcript_id: uuid,
  speaker_id: uuid.nullable(),
  start_ms: z.number().int().nonnegative(),
  end_ms: z.number().int().nonnegative(),
  text: z.string(),
  created_at: ts,
});
export type Segment = z.infer<typeof Segment>;

/** Ata gerada (conteúdo estruturado em content). */
export const Summary = z.object({
  id: uuid,
  recording_id: uuid,
  template_id: uuid.nullable(),
  status: SummaryStatus.default('rascunho'),
  content: z.record(z.unknown()),
  created_at: ts,
});
export type Summary = z.infer<typeof Summary>;

/** Pendência extraída. */
export const ActionItem = z.object({
  id: uuid,
  recording_id: uuid,
  summary_id: uuid.nullable(),
  text: z.string(),
  assignee_person_id: uuid.nullable(),
  due_date: z.string().date().nullable(),
  minute_ms: z.number().int().nonnegative().nullable(),
  status: ActionItemStatus.default('aberta'),
  created_at: ts,
});
export type ActionItem = z.infer<typeof ActionItem>;

/** Modelo de ata (SPEC 9). */
export const Template = z.object({
  id: uuid,
  organization_id: uuid.nullable(),
  key: z.string(),
  name: z.string(),
  sections: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      instructions: z.string().optional(),
    }),
  ),
  created_at: ts,
});
export type Template = z.infer<typeof Template>;

/** Job do pipeline (reprocessável por etapa). */
export const ProcessingJob = z.object({
  id: uuid,
  recording_id: uuid,
  step: JobStep,
  status: JobStatus.default('pending'),
  attempts: z.number().int().nonnegative().default(0),
  error: z.string().nullable(),
  created_at: ts,
  updated_at: ts,
});
export type ProcessingJob = z.infer<typeof ProcessingJob>;
