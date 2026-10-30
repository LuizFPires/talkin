-- Talkin — controle de custo do bot (SPEC 22): só gestor/admin agenda/controla.
-- Agendar/parar bot gera custo; restringe insert/update a gestor/admin.
-- O select continua por membro (transparência: todos veem os bots da empresa).

drop policy if exists meeting_bots_insert on meeting_bots;
create policy meeting_bots_insert on meeting_bots
  for insert with check (
    public.is_org_gestor_or_admin(organization_id) and created_by = auth.uid()
  );

drop policy if exists meeting_bots_update on meeting_bots;
create policy meeting_bots_update on meeting_bots
  for update using (public.is_org_gestor_or_admin(organization_id))
  with check (public.is_org_gestor_or_admin(organization_id));
