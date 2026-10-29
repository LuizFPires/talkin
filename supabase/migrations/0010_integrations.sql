-- Talkin — M7: integrações por empresa (webhook ioo/genérico, regras de calendário).

create table integrations (
  organization_id   uuid primary key references organizations (id) on delete cascade,
  ioo_webhook_url   text,
  webhook_secret    text,
  calendar_rules    jsonb not null default '[]'::jsonb,
  import_meet_teams boolean not null default false,
  updated_at        timestamptz not null default now()
);

alter table integrations enable row level security;
-- Config sensível (URL/segredo): membros leem, só admin escreve.
create policy integrations_select on integrations
  for select using (public.is_org_member(organization_id));
create policy integrations_write on integrations
  for all using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));
