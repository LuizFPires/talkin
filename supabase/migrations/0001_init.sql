-- Talkin — M0 Fundação: modelo de dados
-- Áudio é dado sensível: tudo com organization_id, protegido por RLS (migration 0002).

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ─────────────────────────────── Enums ───────────────────────────────
create type role as enum ('admin', 'gestor', 'membro');
create type visibility as enum ('privada', 'projeto', 'empresa');
create type recording_status as enum (
  'gravando', 'enviando', 'transcrevendo', 'segmentando',
  'resumindo', 'extraindo', 'pronto', 'erro'
);
create type recording_source as enum (
  'presencial', 'meet', 'teams', 'zoom', 'whatsapp', 'importado', 'outro'
);
create type job_step as enum (
  'normalize', 'transcribe', 'segment', 'summarize', 'extract', 'embed'
);
create type job_status as enum ('pending', 'running', 'done', 'error');
create type summary_status as enum ('rascunho', 'revisada');
create type action_item_status as enum ('aberta', 'concluida');
create type audio_retention as enum ('90d', '1y', 'forever');
create type pdf_template as enum ('executiva', 'formal', 'painel');
create type speaker_track as enum ('eu', 'outros', 'desconhecido');

-- ─────────────────────────────── Empresa ─────────────────────────────
create table organizations (
  id                 uuid primary key default gen_random_uuid(),
  nome_fantasia      text not null,
  razao_social       text,
  cnpj               text,
  inscricao_estadual text,
  endereco           text,
  cidade             text,
  uf                 char(2),
  telefone           text,
  site               text,
  logo_url           text,
  logo_light_url     text,
  accent_color       text check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$'),
  pdf_template       pdf_template not null default 'executiva',
  audio_retention    audio_retention not null default '1y',
  created_at         timestamptz not null default now()
);

-- Usuário (id = auth.users.id)
create table profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  full_name       text,
  cargo           text,
  email           text not null,
  telefone        text,
  photo_url       text,
  signature_url   text,
  created_at      timestamptz not null default now()
);
create index profiles_org_idx on profiles (organization_id);

-- Vínculo usuário × empresa com papel (base da RLS)
create table memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            role not null default 'membro',
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index memberships_user_idx on memberships (user_id);
create index memberships_org_idx on memberships (organization_id);

-- Projeto/obra
create table projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name            text not null,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index projects_org_idx on projects (organization_id);

-- Modelo de ata
create table templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations (id) on delete cascade, -- null = modelo global
  key             text not null,
  name            text not null,
  sections        jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);
create index templates_org_idx on templates (organization_id);

-- Gravação
create table recordings (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references organizations (id) on delete cascade,
  project_id               uuid references projects (id) on delete set null,
  created_by               uuid not null references auth.users (id),
  title                    text not null default '',
  source                   recording_source not null default 'importado',
  status                   recording_status not null default 'enviando',
  visibility               visibility not null default 'privada',
  duration_s               integer check (duration_s is null or duration_s >= 0),
  recorded_at              timestamptz,
  template_id              uuid references templates (id) on delete set null,
  cost_transcription_cents integer not null default 0,
  cost_ai_cents            integer not null default 0,
  error                    text,
  created_at               timestamptz not null default now(),
  deleted_at               timestamptz
);
create index recordings_org_idx on recordings (organization_id);
create index recordings_project_idx on recordings (project_id);
create index recordings_status_idx on recordings (status);

-- Bloco de áudio (upload incremental)
create table recording_chunks (
  id           uuid primary key default gen_random_uuid(),
  recording_id uuid not null references recordings (id) on delete cascade,
  index        integer not null,
  storage_path text not null,
  duration_s   numeric,
  bytes        bigint,
  uploaded_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (recording_id, index)
);
create index recording_chunks_rec_idx on recording_chunks (recording_id);

-- Transcrição
create table transcripts (
  id           uuid primary key default gen_random_uuid(),
  recording_id uuid not null references recordings (id) on delete cascade,
  language     text not null default 'pt-BR',
  provider     text,
  created_at   timestamptz not null default now()
);
create index transcripts_rec_idx on transcripts (recording_id);

-- Falante
create table speakers (
  id           uuid primary key default gen_random_uuid(),
  recording_id uuid not null references recordings (id) on delete cascade,
  label        text not null,
  person_id    uuid,
  display_name text,
  track        speaker_track not null default 'desconhecido',
  created_at   timestamptz not null default now()
);
create index speakers_rec_idx on speakers (recording_id);

-- Trecho da transcrição
create table segments (
  id            uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references transcripts (id) on delete cascade,
  speaker_id    uuid references speakers (id) on delete set null,
  start_ms      integer not null check (start_ms >= 0),
  end_ms        integer not null check (end_ms >= 0),
  text          text not null,
  embedding     vector(1536),
  created_at    timestamptz not null default now()
);
create index segments_transcript_idx on segments (transcript_id);

-- Ata
create table summaries (
  id           uuid primary key default gen_random_uuid(),
  recording_id uuid not null references recordings (id) on delete cascade,
  template_id  uuid references templates (id) on delete set null,
  status       summary_status not null default 'rascunho',
  content      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index summaries_rec_idx on summaries (recording_id);

-- Pendência
create table action_items (
  id                 uuid primary key default gen_random_uuid(),
  recording_id       uuid not null references recordings (id) on delete cascade,
  summary_id         uuid references summaries (id) on delete set null,
  text               text not null,
  assignee_person_id uuid,
  due_date           date,
  minute_ms          integer check (minute_ms is null or minute_ms >= 0),
  status             action_item_status not null default 'aberta',
  created_at         timestamptz not null default now()
);
create index action_items_rec_idx on action_items (recording_id);

-- Fila de processamento (reprocessável por etapa)
create table processing_jobs (
  id           uuid primary key default gen_random_uuid(),
  recording_id uuid not null references recordings (id) on delete cascade,
  step         job_step not null,
  status       job_status not null default 'pending',
  attempts     integer not null default 0,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index processing_jobs_rec_idx on processing_jobs (recording_id);
create index processing_jobs_status_idx on processing_jobs (status);
