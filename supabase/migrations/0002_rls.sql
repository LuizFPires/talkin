-- Talkin — M0: Row Level Security. Isolamento por empresa + visibilidade da gravação.
-- Funções SECURITY DEFINER evitam recursão de RLS ao consultar memberships.

create or replace function public.current_org_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select organization_id from memberships where user_id = auth.uid();
$$;

create or replace function public.is_org_member(org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and organization_id = org
  );
$$;

create or replace function public.is_org_admin(org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and organization_id = org and role = 'admin'
  );
$$;

create or replace function public.is_org_gestor_or_admin(org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and organization_id = org and role in ('admin', 'gestor')
  );
$$;

-- Acesso a uma gravação respeitando a visibilidade (SPEC 23).
-- Usado nas policies de select e nas policies de storage do áudio.
create or replace function public.can_access_recording(rec uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from recordings r
    where r.id = rec
      and public.is_org_member(r.organization_id)
      and (
        r.visibility = 'empresa'
        or r.created_by = auth.uid()
        or public.is_org_admin(r.organization_id)
        or (r.visibility = 'projeto' and public.is_org_gestor_or_admin(r.organization_id))
      )
  );
$$;

-- Escrita numa gravação: só o dono ou admin da empresa (o worker usa service_role).
create or replace function public.can_modify_recording(rec uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from recordings r
    where r.id = rec
      and public.is_org_member(r.organization_id)
      and (r.created_by = auth.uid() or public.is_org_admin(r.organization_id))
  );
$$;

-- ─────────────── Bootstrap seguro de empresa (sem self-insert) ────────────────
-- Cria a empresa, torna o criador admin e preenche o profile numa transação só.
create or replace function public.create_organization(p_nome_fantasia text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'não autenticado';
  end if;
  -- Um usuário só cria uma empresa (evita reatribuir org e criar empresas em excesso).
  if exists (select 1 from memberships where user_id = v_uid) then
    raise exception 'usuário já pertence a uma empresa';
  end if;
  select email into v_email from auth.users where id = v_uid;

  insert into organizations (nome_fantasia) values (p_nome_fantasia) returning id into v_org;
  insert into memberships (organization_id, user_id, role) values (v_org, v_uid, 'admin');
  insert into profiles (id, organization_id, email)
    values (v_uid, v_org, coalesce(v_email, ''))
  on conflict (id) do update set organization_id = excluded.organization_id;

  return v_org;
end;
$$;

-- Preenche profiles.email a partir de auth.users (não confia no cliente).
create or replace function public.profiles_set_email()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.email := coalesce((select email from auth.users where id = new.id), new.email);
  return new;
end;
$$;

create trigger profiles_email_trg
  before insert or update on profiles
  for each row execute function public.profiles_set_email();

-- Campos de servidor (custo, status de pipeline, dono/empresa) só mudam via service_role.
-- Vale para INSERT e UPDATE; o cliente nunca escreve billing nem forja estado.
create or replace function public.recordings_guard_server_fields()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if tg_op = 'INSERT' then
      -- cliente começa sem custo e só em estados de captura
      new.cost_transcription_cents := 0;
      new.cost_ai_cents := 0;
      if new.status is null or new.status not in ('gravando', 'enviando', 'erro') then
        new.status := 'enviando';
      end if;
    else -- UPDATE
      new.cost_transcription_cents := old.cost_transcription_cents;
      new.cost_ai_cents := old.cost_ai_cents;
      new.created_by := old.created_by;         -- dono imutável
      new.organization_id := old.organization_id; -- empresa imutável
      -- cliente não força estados internos de pipeline nem 'pronto'
      if new.status is distinct from old.status
         and new.status not in ('gravando', 'enviando', 'erro') then
        new.status := old.status;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger recordings_guard_trg
  before insert or update on recordings
  for each row execute function public.recordings_guard_server_fields();

-- ─────────────────────────── Habilitar RLS ───────────────────────────
alter table organizations    enable row level security;
alter table profiles         enable row level security;
alter table memberships      enable row level security;
alter table projects         enable row level security;
alter table templates        enable row level security;
alter table recordings       enable row level security;
alter table recording_chunks enable row level security;
alter table transcripts      enable row level security;
alter table speakers         enable row level security;
alter table segments         enable row level security;
alter table summaries        enable row level security;
alter table action_items     enable row level security;
alter table processing_jobs  enable row level security;

-- ─────────────────────────── organizations ───────────────────────────
-- Criação só via create_organization() (SECURITY DEFINER); sem policy de insert.
create policy org_select on organizations
  for select using (public.is_org_member(id));
create policy org_update on organizations
  for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy org_delete on organizations
  for delete using (public.is_org_admin(id));

-- ───────────────────────────── profiles ──────────────────────────────
create policy profiles_select on profiles
  for select using (id = auth.uid() or organization_id in (select public.current_org_ids()));
create policy profiles_insert on profiles
  for insert with check (id = auth.uid() and organization_id in (select public.current_org_ids()));
create policy profiles_update on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and organization_id in (select public.current_org_ids()));

-- ──────────────────────────── memberships ────────────────────────────
-- Só admin administra membros; o primeiro admin nasce no create_organization().
create policy memberships_select on memberships
  for select using (organization_id in (select public.current_org_ids()));
create policy memberships_insert on memberships
  for insert with check (public.is_org_admin(organization_id));
create policy memberships_update on memberships
  for update using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));
create policy memberships_delete on memberships
  for delete using (public.is_org_admin(organization_id));

-- ─────────────── Tabelas com organization_id direto ──────────────────
create policy projects_all on projects
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy templates_select on templates
  for select using (organization_id is null or public.is_org_member(organization_id));
-- Modelos de ata são artefato de negócio: só gestor/admin escreve.
create policy templates_write on templates
  for all using (organization_id is not null and public.is_org_gestor_or_admin(organization_id))
  with check (organization_id is not null and public.is_org_gestor_or_admin(organization_id));

-- recordings: select respeita visibilidade; insert/update checam dono + FKs da mesma empresa.
create policy recordings_select on recordings
  for select using (
    public.is_org_member(organization_id) and (
      visibility = 'empresa'
      or created_by = auth.uid()
      or public.is_org_admin(organization_id)
      or (visibility = 'projeto' and public.is_org_gestor_or_admin(organization_id))
    )
  );
create policy recordings_insert on recordings
  for insert with check (
    public.is_org_member(organization_id)
    and created_by = auth.uid()
    and (
      project_id is null
      or exists (select 1 from projects p where p.id = project_id and p.organization_id = recordings.organization_id)
    )
    and (
      template_id is null
      or exists (
        select 1 from templates t
        where t.id = template_id and (t.organization_id is null or t.organization_id = recordings.organization_id)
      )
    )
  );
create policy recordings_update on recordings
  for update using (
    public.is_org_member(organization_id)
    and (created_by = auth.uid() or public.is_org_admin(organization_id))
  )
  with check (
    public.is_org_member(organization_id)
    and (created_by = auth.uid() or public.is_org_admin(organization_id))
    and (
      project_id is null
      or exists (select 1 from projects p where p.id = project_id and p.organization_id = recordings.organization_id)
    )
    and (
      template_id is null
      or exists (
        select 1 from templates t
        where t.id = template_id and (t.organization_id is null or t.organization_id = recordings.organization_id)
      )
    )
  );
create policy recordings_delete on recordings
  for delete using (created_by = auth.uid() or public.is_org_admin(organization_id));

-- ─────────────── Tabelas-filhas: leitura por acesso, escrita por dono/admin ───────────────
-- O worker do pipeline escreve via service_role (ignora RLS). O cliente só escreve
-- no que é dele (can_modify_recording). Leitura respeita a visibilidade (can_access).

-- recording_chunks: além de dono/admin, o caminho precisa ser {org}/{recording_id}/...
create policy recording_chunks_select on recording_chunks
  for select using (public.can_access_recording(recording_id));
create policy recording_chunks_insert on recording_chunks
  for insert with check (
    public.can_modify_recording(recording_id)
    and exists (
      select 1 from recordings r
      where r.id = recording_id
        and storage_path like r.organization_id::text || '/' || recording_id::text || '/%'
    )
  );
create policy recording_chunks_update on recording_chunks
  for update using (public.can_modify_recording(recording_id))
  with check (
    public.can_modify_recording(recording_id)
    and exists (
      select 1 from recordings r
      where r.id = recording_id
        and storage_path like r.organization_id::text || '/' || recording_id::text || '/%'
    )
  );
create policy recording_chunks_delete on recording_chunks
  for delete using (public.can_modify_recording(recording_id));

create policy transcripts_select on transcripts
  for select using (public.can_access_recording(recording_id));
create policy transcripts_write on transcripts
  for all using (public.can_modify_recording(recording_id))
  with check (public.can_modify_recording(recording_id));

create policy speakers_select on speakers
  for select using (public.can_access_recording(recording_id));
create policy speakers_write on speakers
  for all using (public.can_modify_recording(recording_id))
  with check (public.can_modify_recording(recording_id));

create policy summaries_select on summaries
  for select using (public.can_access_recording(recording_id));
create policy summaries_write on summaries
  for all using (public.can_modify_recording(recording_id))
  with check (public.can_modify_recording(recording_id));

create policy action_items_select on action_items
  for select using (public.can_access_recording(recording_id));
create policy action_items_write on action_items
  for all using (public.can_modify_recording(recording_id))
  with check (public.can_modify_recording(recording_id));

-- processing_jobs: cliente só lê; escrita é do worker (service_role, que ignora RLS).
create policy processing_jobs_select on processing_jobs
  for select using (public.can_access_recording(recording_id));

-- segments: leitura via transcript → recording (acesso); escrita por dono/admin.
create policy segments_select on segments
  for select using (
    exists (
      select 1 from transcripts t
      where t.id = segments.transcript_id and public.can_access_recording(t.recording_id)
    )
  );
create policy segments_write on segments
  for all using (
    exists (
      select 1 from transcripts t
      where t.id = segments.transcript_id and public.can_modify_recording(t.recording_id)
    )
  )
  with check (
    exists (
      select 1 from transcripts t
      where t.id = segments.transcript_id and public.can_modify_recording(t.recording_id)
    )
  );
