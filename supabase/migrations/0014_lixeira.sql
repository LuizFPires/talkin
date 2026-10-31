-- 0014 · Lixeira de gravações (SPEC 24)
-- Índice parcial para listar a lixeira e para o expurgo diário (deleted_at < agora - 30 dias).
-- A exclusão lógica (deleted_at) e as políticas de dono/admin já existem desde a 0002.
create index if not exists recordings_deleted_idx
  on recordings (organization_id, deleted_at desc)
  where deleted_at is not null;
