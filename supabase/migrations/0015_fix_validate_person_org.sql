-- 0015 · Corrige o gatilho validate_person_org (0009).
--
-- Bug: a versão anterior calculava a pessoa com
--   case tg_table_name when 'action_items' then new.assignee_person_id else new.person_id end
-- numa expressão só. O PL/pgSQL compila a expressão inteira, então em `speakers`
-- (que não tem assignee_person_id) todo INSERT/UPDATE falhava com
--   42703: record "new" has no field "assignee_person_id"
-- — nenhum falante podia ser criado (transcrição ao vivo e importação quebradas).
--
-- Correção: lê o campo pelo nome via jsonb, que devolve null quando a coluna não
-- existe, sem referenciar colunas da outra tabela. Mesma regra de negócio:
-- a pessoa vinculada tem de ser da mesma empresa da gravação.
create or replace function public.validate_person_org()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_person uuid := case
    when tg_table_name = 'action_items' then (v_row ->> 'assignee_person_id')::uuid
    else (v_row ->> 'person_id')::uuid
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
