-- Talkin — ganhos rápidos de performance (revisão de performance).
-- Índices para os caminhos mais usados, gravação de embeddings em lote,
-- custo de IA atômico e mais recall na busca semântica (ivfflat.probes).

-- 1) Biblioteca/busca: filtro por organização + ordenação por data (índice parcial).
create index if not exists recordings_org_created_idx
  on recordings (organization_id, created_at desc)
  where deleted_at is null;

-- 2) Filtro por participante (nome exibido do falante).
create index if not exists speakers_display_name_idx
  on speakers (display_name);

-- 3) Busca "palavra exata" (ilike '%...%') indexada por trigramas.
create extension if not exists pg_trgm;
create index if not exists segments_text_trgm_idx
  on segments using gin (text gin_trgm_ops);

-- 4) Gravação de embeddings em lote: 1 chamada em vez de N updates (etapa embed).
--    Chamada pelo worker (service role); atualiza só por id.
create or replace function public.set_segment_embeddings(p_ids uuid[], p_embs text[])
returns void
language plpgsql security definer set search_path = public
as $$
begin
  -- Só o worker (service role). SECURITY DEFINER ignora RLS, então travamos o acesso.
  if auth.role() <> 'service_role' then
    raise exception 'acesso negado';
  end if;
  update segments s
     set embedding = v.emb::vector
    from (select unnest(p_ids) as id, unnest(p_embs) as emb) v
   where s.id = v.id;
end;
$$;
revoke execute on function public.set_segment_embeddings(uuid[], text[]) from public;
grant execute on function public.set_segment_embeddings(uuid[], text[]) to service_role;

-- 5) Incremento atômico do custo de IA (evita corrida de read-modify-write).
create or replace function public.increment_ai_cost(p_recording uuid, p_cents int)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  -- Só o worker (service role); o guard de recordings já barra, mas blindamos a RPC.
  if auth.role() <> 'service_role' then
    raise exception 'acesso negado';
  end if;
  update recordings
     set cost_ai_cents = coalesce(cost_ai_cents, 0) + p_cents
   where id = p_recording;
end;
$$;
revoke execute on function public.increment_ai_cost(uuid, int) from public;
grant execute on function public.increment_ai_cost(uuid, int) to service_role;

-- 6) Busca semântica: varrer mais listas do ivfflat melhora o recall (default = 1).
--    O SET da função aplica só durante a chamada e reseta depois.
create or replace function public.match_segments(
  query_embedding vector(1536),
  match_count int default 20,
  p_recording uuid default null,
  p_recordings uuid[] default null
)
returns table (
  recording_id uuid,
  recording_title text,
  start_ms int,
  text text,
  similarity real
)
language sql stable security definer
set search_path = public
set ivfflat.probes = 10
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
    and (p_recordings is null or r.id = any(p_recordings))
  order by s.embedding <=> query_embedding
  limit match_count;
$$;
