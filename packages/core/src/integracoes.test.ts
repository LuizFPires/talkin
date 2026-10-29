import { describe, expect, it } from 'vitest';
import { buildWebhookPayload, sugerirPorEvento, type RegraCalendario } from './integracoes';
import type { AtaContent } from './extraction';

const regras: RegraCalendario[] = [
  { tituloContem: 'obra', templateKey: 'obra' },
  { participante: 'Fornecedor X', templateKey: 'fornecedor', projectName: 'Galpão A' },
];

describe('sugerirPorEvento', () => {
  it('sugere modelo pelo título', () => {
    expect(sugerirPorEvento('Reunião de obra semanal', [], regras)).toEqual({
      templateKey: 'obra',
    });
  });
  it('sugere modelo e projeto pelo participante', () => {
    expect(sugerirPorEvento('Conversa', ['Fornecedor X'], regras)).toEqual({
      templateKey: 'fornecedor',
      projectName: 'Galpão A',
    });
  });
  it('sem regra batendo, não sugere nada', () => {
    expect(sugerirPorEvento('Bate-papo', ['Ana'], regras)).toEqual({});
  });
});

describe('buildWebhookPayload', () => {
  it('inclui só o acionável (decisões e pendências)', () => {
    const ata: AtaContent = {
      resumo: 'x',
      secoes: [],
      extracao: {
        decisoes: [{ texto: 'Fechar concretagem', minuto_ms: 1000, quem: null }],
        pendencias: [
          {
            texto: 'Confirmar prazo',
            responsavel: 'Marcos',
            prazo: '2026-10-31',
            prazo_estimado: false,
            minuto_ms: 0,
          },
        ],
        valores: [],
        prazos: [],
        riscos: [],
      },
    };
    const p = buildWebhookPayload('rec1', 'Obra', ata, true);
    expect(p.revisada).toBe(true);
    expect(p.decisoes).toHaveLength(1);
    expect(p.pendencias[0]!.responsavel).toBe('Marcos');
  });
});
