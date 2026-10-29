-- Talkin — M5: busca por significado (pgvector) + RPC que respeita o acesso.

-- Índice ivfflat para similaridade por cosseno nos embeddings dos trechos.
create index if not exists segments_embedding_idx
  on segments using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Busca semântica: trechos mais próximos da consulta, só das gravações a que
-- o usuário tem acesso (can_access_recording). Opcionalmente restrita a uma gravação.
create or replace function public.match_segments(
  query_embedding vector(1536),
  match_count int default 20,
  p_recording uuid default null
)
returns table (
  recording_id uuid,
  recording_title text,
  start_ms int,
  text text,
  similarity real
)
language sql stable security definer set search_path = public
as $$
  select r.id, r.title, s.start_ms, s.text,
         1 - (s.embedding <=> query_embedding) as similarity
  from segments s
  join transcripts t on t.id = s.transcript_id
  join recordings r on r.id = t.recording_id
  where s.embedding is not null
    and r.deleted_at is null
    and public.can_access_recording(r.id)
    and (p_recording is null or r.id = p_recording)
  order by s.embedding <=> query_embedding
  limit match_count;
$$;
