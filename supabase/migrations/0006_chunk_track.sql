-- Talkin — M3: faixa do bloco (desktop grava "eu" × "outros").
-- Metadado para diarização por faixa no pipeline. O índice continua GLOBAL e
-- único por gravação (unique(recording_id, index) do 0001): o módulo nativo
-- emite um índice monotônico compartilhado entre as faixas, então não há colisão.
alter table recording_chunks add column if not exists track speaker_track;
