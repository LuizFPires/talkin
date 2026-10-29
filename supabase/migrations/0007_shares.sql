-- Talkin — M4: link privado da ata com expiração (SPEC 18).
-- O acesso público é só pela RPC get_shared_ata (SECURITY DEFINER); a tabela
-- em si fica fechada por RLS ao dono/admin da gravação.

create table shares (
  id            uuid primary key default gen_random_uuid(),
  recording_id  uuid not null references recordings (id) on delete cascade,
  token         text not null unique,
  expires_at    timestamptz,            -- null = sem expiração
  include_audio boolean not null default false,
  created_by    uuid not null references auth.users (id),
  created_at    timestamptz not null default now()
);
create index shares_recording_idx on shares (recording_id);

alter table shares enable row level security;

create policy shares_all on shares
  for all using (public.can_modify_recording(recording_id))
  with check (public.can_modify_recording(recording_id) and created_by = auth.uid());

-- Leitura pública da ata por token, respeitando a expiração. Não expõe áudio.
create or replace function public.get_shared_ata(p_token text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'title', r.title,
    'date', r.created_at,
    'source', r.source,
    'content', s.content,
    'org', jsonb_build_object(
      'nome_fantasia', o.nome_fantasia,
      'accent_color', o.accent_color,
      'site', o.site,
      'pdf_template', o.pdf_template
    )
  )
  from shares sh
  join recordings r on r.id = sh.recording_id
  join organizations o on o.id = r.organization_id
  join lateral (
    select content from summaries
    where recording_id = r.id
    order by created_at desc
    limit 1
  ) s on true
  where sh.token = p_token
    and (sh.expires_at is null or sh.expires_at > now())
    and r.deleted_at is null;
$$;
