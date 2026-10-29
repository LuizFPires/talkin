import { describe, expect, it } from 'vitest';
import { buildAtaHtml } from './html';
import type { AtaDoc } from './types';

const doc: AtaDoc = {
  org: {
    nome_fantasia: 'Construtora Exemplo',
    accent_color: '#94efda',
    cnpj: '00.000.000/0001-00',
  },
  recording: {
    title: 'Reunião de obra semanal',
    date: '2026-10-29T12:00:00-03:00',
    durationS: 3600,
    source: 'Presencial',
    participants: ['Marcos', 'Júlio'],
    revisada: true,
  },
  ata: {
    resumo: 'Tratou do prazo da estrutura.',
    secoes: [{ key: 'resumo', title: 'Resumo', body: 'Concretagem sexta.', minutos_ms: [4000] }],
    extracao: {
      decisoes: [{ texto: 'Concretagem 30/10', minuto_ms: 4000, quem: 'Júlio' }],
      pendencias: [
        {
          texto: 'Confirmar prazo',
          responsavel: null,
          prazo: '2026-10-31',
          prazo_estimado: false,
          minuto_ms: 0,
        },
      ],
      valores: [{ descricao: 'Concreto', valor: 512, unidade: 'R$', minuto_ms: 1000 }],
      prazos: [{ evento: 'Concretagem', data: '2026-10-30', minuto_ms: 4000 }],
      riscos: [],
    },
  },
};

describe('buildAtaHtml', () => {
  it('monta a ata Executiva com Sora, acento e formato BR', () => {
    const html = buildAtaHtml(doc);
    expect(html).toContain('family=Sora');
    expect(html).toContain('--accent: #94efda');
    expect(html).toContain('Reunião de obra semanal');
    expect(html).toContain('Revisada');
    expect(html).toContain('R$ 512,00'); // valor em formato BR
    expect(html).toContain('31/10/2026'); // prazo dd/mm/aaaa
    expect(html).toContain('break-inside: avoid'); // sem título órfão
  });

  it('usa o nome fantasia quando não há logo', () => {
    const html = buildAtaHtml(doc);
    expect(html).toContain('Construtora Exemplo');
  });

  it('escapa conteúdo para evitar HTML injetado', () => {
    const malicioso = structuredClone(doc);
    malicioso.ata.resumo = '<script>alert(1)</script>';
    const html = buildAtaHtml(malicioso);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
