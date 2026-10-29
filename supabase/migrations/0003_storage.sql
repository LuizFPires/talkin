-- Talkin — M0: buckets de áudio e logos. Privados, RLS por empresa.
-- Convenção de caminho: {organization_id}/{recording_id}/{arquivo}.
-- Links de compartilhamento são sempre URLs assinadas com expiração.

insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('logos', 'logos', false)
on conflict (id) do nothing;

-- Caminho: {organization_id}/{recording_id}/{arquivo}.
-- Leitura respeita a visibilidade da gravação (a 2ª pasta é o recording_id).
create policy "audio por empresa — select" on storage.objects
  for select using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1]::uuid in (select public.current_org_ids())
    and (
      (storage.foldername(name))[2] is null
      or public.can_access_recording((storage.foldername(name))[2]::uuid)
    )
  );
-- Escrita exige a 2ª pasta (recording_id) e permissão de escrita na gravação (dono/admin),
-- em paridade com recordings_update/delete.
-- Consistência: a 1ª pasta (org) tem de ser a empresa da própria gravação da 2ª pasta.
create policy "audio por empresa — insert" on storage.objects
  for insert with check (
    bucket_id = 'audio'
    and (storage.foldername(name))[2] is not null
    and public.can_modify_recording((storage.foldername(name))[2]::uuid)
    and (storage.foldername(name))[1]::uuid
      = (select organization_id from recordings where id = (storage.foldername(name))[2]::uuid)
  );
create policy "audio por empresa — update" on storage.objects
  for update using (
    bucket_id = 'audio'
    and (storage.foldername(name))[2] is not null
    and public.can_modify_recording((storage.foldername(name))[2]::uuid)
    and (storage.foldername(name))[1]::uuid
      = (select organization_id from recordings where id = (storage.foldername(name))[2]::uuid)
  )
  with check (
    bucket_id = 'audio'
    and (storage.foldername(name))[2] is not null
    and public.can_modify_recording((storage.foldername(name))[2]::uuid)
    and (storage.foldername(name))[1]::uuid
      = (select organization_id from recordings where id = (storage.foldername(name))[2]::uuid)
  );
create policy "audio por empresa — delete" on storage.objects
  for delete using (
    bucket_id = 'audio'
    and (storage.foldername(name))[2] is not null
    and public.can_modify_recording((storage.foldername(name))[2]::uuid)
    and (storage.foldername(name))[1]::uuid
      = (select organization_id from recordings where id = (storage.foldername(name))[2]::uuid)
  );

create policy "logos por empresa — select" on storage.objects
  for select using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1]::uuid in (select public.current_org_ids())
  );
-- A logomarca é da empresa (vai no PDF da ata): só gestor/admin escreve.
create policy "logos por empresa — insert" on storage.objects
  for insert with check (
    bucket_id = 'logos'
    and public.is_org_gestor_or_admin((storage.foldername(name))[1]::uuid)
  );
create policy "logos por empresa — update" on storage.objects
  for update using (
    bucket_id = 'logos'
    and public.is_org_gestor_or_admin((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'logos'
    and public.is_org_gestor_or_admin((storage.foldername(name))[1]::uuid)
  );
create policy "logos por empresa — delete" on storage.objects
  for delete using (
    bucket_id = 'logos'
    and public.is_org_gestor_or_admin((storage.foldername(name))[1]::uuid)
  );
