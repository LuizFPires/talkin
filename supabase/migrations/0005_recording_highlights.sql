-- Talkin — M2: momentos marcados durante a gravação (SPEC 5).
-- Viram destaques na ata (passados ao pipeline em highlights).
alter table recordings add column if not exists highlights jsonb not null default '[]'::jsonb;
