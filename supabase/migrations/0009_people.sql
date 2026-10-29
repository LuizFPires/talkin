-- Talkin — M6: cadastro de pessoas + vínculo com falantes e pendências.

create table people (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name            text not null,
  empresa         text,
  papel           text,
  contato         text,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index people_org_idx on people (organization_id);

alter table people enable row level security;
create policy people_all on people
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- Vincula falante e pendência a uma pessoa cadastrada (SET NULL se a pessoa sair).
alter table speakers
  add constraint speakers_person_fk
  foreign key (person_id) references people (id) on delete set null;

alter table action_items
  add constraint action_items_person_fk
  foreign key (assignee_person_id) references people (id) on delete set null;
