-- Talkin — M8: bot de reunião (opcional). Entra na reunião, grava e sai.

create type bot_status as enum ('agendado', 'entrando', 'gravando', 'saiu', 'erro');

create table meeting_bots (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  recording_id    uuid references recordings (id) on delete set null,
  platform        text not null,
  meeting_url     text not null,
  provider_bot_id text,
  status          bot_status not null default 'agendado',
  cost_cents      integer not null default 0,
  scheduled_at    timestamptz,
  created_by      uuid not null references auth.users (id),
  created_at      timestamptz not null default now()
);
create index meeting_bots_org_idx on meeting_bots (organization_id);

alter table meeting_bots enable row level security;
create policy meeting_bots_select on meeting_bots
  for select using (public.is_org_member(organization_id));
create policy meeting_bots_insert on meeting_bots
  for insert with check (public.is_org_member(organization_id) and created_by = auth.uid());
create policy meeting_bots_update on meeting_bots
  for update using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy meeting_bots_delete on meeting_bots
  for delete using (created_by = auth.uid() or public.is_org_admin(organization_id));
