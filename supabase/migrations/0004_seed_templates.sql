-- Talkin — M0: modelos de ata globais (SPEC 9). organization_id null = global.

insert into templates (organization_id, key, name, sections) values
(null, 'generico', 'Genérico',
  '[{"key":"resumo","title":"Resumo"},{"key":"topicos","title":"Tópicos"},{"key":"decisoes","title":"Decisões"},{"key":"pendencias","title":"Pendências"}]'::jsonb),
(null, 'obra', 'Reunião de obra',
  '[{"key":"resumo","title":"Resumo"},{"key":"avanco","title":"Avanço e atrasos"},{"key":"decisoes","title":"Decisões"},{"key":"pendencias","title":"Pendências por responsável"},{"key":"valores","title":"Valores"},{"key":"riscos","title":"Riscos"},{"key":"proxima","title":"Próxima reunião"}]'::jsonb),
(null, 'visita', 'Visita técnica',
  '[{"key":"local","title":"Local"},{"key":"observacoes","title":"Observações"},{"key":"ncs","title":"Não conformidades"},{"key":"fotos","title":"Fotos citadas"},{"key":"providencias","title":"Providências"}]'::jsonb),
(null, 'cliente', 'Reunião com cliente',
  '[{"key":"objetivo","title":"Objetivo"},{"key":"pedidos","title":"Pedidos do cliente"},{"key":"compromissos","title":"Compromissos assumidos"},{"key":"proximos","title":"Próximos passos"},{"key":"sensiveis","title":"Pontos sensíveis"}]'::jsonb),
(null, 'fornecedor', 'Negociação com fornecedor',
  '[{"key":"escopo","title":"Escopo"},{"key":"precos","title":"Preços e condições"},{"key":"prazos","title":"Prazos de entrega"},{"key":"concessoes","title":"Concessões de cada lado"},{"key":"pendencias","title":"Pendências"},{"key":"fecha","title":"Quem fecha"}]'::jsonb),
(null, 'socios', 'Sócios / investidores',
  '[{"key":"pauta","title":"Pauta"},{"key":"deliberacoes","title":"Deliberações"},{"key":"numeros","title":"Números apresentados"},{"key":"pendencias","title":"Pendências"},{"key":"votacoes","title":"Votações/consensos"}]'::jsonb);
