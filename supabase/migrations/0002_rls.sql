-- Talkin — M0: Row Level Security. Isolamento por empresa.
-- Toda leitura/escrita passa pela função de membership (SECURITY DEFINER evita
-- recursão de RLS ao consultar a própria tabela memberships).

create or replace function public.current_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from memberships where user_id = auth.uid();
$$;

create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and organization_id = org
  );
$$;

create or replace function public.is_org_admin(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and organization_id = org and role = 'admin'
  );
$$;

create or replace function public.can_access_recording(rec uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from recordings r
    where r.id = rec and public.is_org_member(r.organization_id)
  );
$$;

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
create policy org_select on organizations
  for select using (public.is_org_member(id));
create policy org_insert on organizations
  for insert with check (auth.uid() is not null);
create policy org_update on organizations
  for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy org_delete on organizations
  for delete using (public.is_org_admin(id));

-- ───────────────────────────── profiles ──────────────────────────────
create policy profiles_select on profiles
  for select using (id = auth.uid() or organization_id in (select public.current_org_ids()));
create policy profiles_insert on profiles
  for insert with check (id = auth.uid());
create policy profiles_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ──────────────────────────── memberships ────────────────────────────
create policy memberships_select on memberships
  for select using (organization_id in (select public.current_org_ids()));
-- bootstrap: o usuário pode se adicionar; depois só admin administra
create policy memberships_insert on memberships
  for insert with check (user_id = auth.uid() or public.is_org_admin(organization_id));
create policy memberships_update on memberships
  for update using (public.is_org_admin(organization_id));
create policy memberships_delete on memberships
  for delete using (public.is_org_admin(organization_id));

-- ─────────────── Tabelas com organization_id direto ──────────────────
create policy projects_all on projects
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- templates globais (organization_id null) são legíveis por qualquer autenticado
create policy templates_select on templates
  for select using (organization_id is null or public.is_org_member(organization_id));
create policy templates_write on templates
  for all using (organization_id is not null and public.is_org_member(organization_id))
  with check (organization_id is not null and public.is_org_member(organization_id));

create policy recordings_all on recordings
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- ─────────────── Tabelas-filhas (acesso via gravação) ────────────────
create policy recording_chunks_all on recording_chunks
  for all using (public.can_access_recording(recording_id))
  with check (public.can_access_recording(recording_id));

create policy transcripts_all on transcripts
  for all using (public.can_access_recording(recording_id))
  with check (public.can_access_recording(recording_id));

create policy speakers_all on speakers
  for all using (public.can_access_recording(recording_id))
  with check (public.can_access_recording(recording_id));

create policy summaries_all on summaries
  for all using (public.can_access_recording(recording_id))
  with check (public.can_access_recording(recording_id));

create policy action_items_all on action_items
  for all using (public.can_access_recording(recording_id))
  with check (public.can_access_recording(recording_id));

create policy processing_jobs_all on processing_jobs
  for all using (public.can_access_recording(recording_id))
  with check (public.can_access_recording(recording_id));

-- segments: acesso via transcript → recording
create policy segments_all on segments
  for all using (
    exists (
      select 1 from transcripts t
      where t.id = segments.transcript_id and public.can_access_recording(t.recording_id)
    )
  )
  with check (
    exists (
      select 1 from transcripts t
      where t.id = segments.transcript_id and public.can_access_recording(t.recording_id)
    )
  );
