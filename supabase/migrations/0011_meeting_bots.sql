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

-- Campos de servidor (provider_bot_id, cost_cents, status de execução) só mudam
-- via service_role (worker/rota). O cliente só pode desligar (status 'saiu').
create or replace function public.meeting_bots_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if tg_op = 'INSERT' then
      new.provider_bot_id := null;
      new.cost_cents := 0;
      new.status := 'agendado';
    else
      new.provider_bot_id := old.provider_bot_id;
      new.cost_cents := old.cost_cents;
      new.organization_id := old.organization_id;
      new.created_by := old.created_by;
      -- cliente só pode encerrar; demais estados são do worker
      if new.status is distinct from old.status and new.status <> 'saiu' then
        new.status := old.status;
      end if;
    end if;
    -- recording_id (se houver) tem de ser da mesma empresa
    if new.recording_id is not null and not exists (
      select 1 from recordings r
      where r.id = new.recording_id and r.organization_id = new.organization_id
    ) then
      raise exception 'gravação de outra empresa';
    end if;
  end if;
  return new;
end;
$$;

create trigger meeting_bots_guard_trg
  before insert or update on meeting_bots
  for each row execute function public.meeting_bots_guard();
