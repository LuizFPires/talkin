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
-- Membros leem; só gestor/admin escreve (artefato compartilhado, como modelos).
create policy people_select on people
  for select using (public.is_org_member(organization_id));
create policy people_write on people
  for all using (public.is_org_gestor_or_admin(organization_id))
  with check (public.is_org_gestor_or_admin(organization_id));

-- Vincula falante e pendência a uma pessoa cadastrada (SET NULL se a pessoa sair).
alter table speakers
  add constraint speakers_person_fk
  foreign key (person_id) references people (id) on delete set null;

alter table action_items
  add constraint action_items_person_fk
  foreign key (assignee_person_id) references people (id) on delete set null;

-- Impede referência cross-tenant: a pessoa tem de ser da mesma empresa da gravação.
create or replace function public.validate_person_org()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_person uuid := case tg_table_name
    when 'action_items' then new.assignee_person_id
    else new.person_id
  end;
  v_rec_org uuid;
  v_person_org uuid;
begin
  if v_person is null then
    return new;
  end if;
  select organization_id into v_rec_org from recordings where id = new.recording_id;
  select organization_id into v_person_org from people where id = v_person;
  if v_person_org is distinct from v_rec_org then
    raise exception 'pessoa de outra empresa';
  end if;
  return new;
end;
$$;

create trigger speakers_person_org_trg
  before insert or update on speakers
  for each row execute function public.validate_person_org();

create trigger action_items_person_org_trg
  before insert or update on action_items
  for each row execute function public.validate_person_org();
