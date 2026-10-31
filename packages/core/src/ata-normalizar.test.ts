import { describe, expect, it } from 'vitest';
import { normalizarAta, AtaLLM } from './ata-normalizar';

describe('normalizarAta', () => {
  it('descarta só a pendência sem texto (caso visto em produção) e mantém o resto', () => {
    const { ata, descartados } = normalizarAta({
      resumo: 'Reunião de obra.',
      secoes: [{ key: 'resumo', title: 'Resumo', body: 'Texto.', minutos_ms: [4000, -1] }],
      extracao: {
        decisoes: [{ texto: 'Aprovado o aditivo.', minuto_ms: 430000, quem: null }],
        pendencias: [
          { responsavel: 'Marcos', prazo: '2026-10-31', prazo_estimado: false, minuto_ms: 1 },
          { texto: 'Ana cobra a ART.', responsavel: 'Ana', prazo: '', prazo_estimado: true },
        ],
        valores: [{ descricao: 'Aditivo', valor: 18500, unidade: '', minuto_ms: null }],
        prazos: [
          { evento: 'Esquadrias', data: '13/11/2026' },
          { evento: 'Vago', data: 'logo' },
        ],
        riscos: [{ texto: 'Chuva', gravidade: 'altíssima' }],
      },
    });
    expect(descartados).toBe(2);
    expect(ata.secoes[0]!.minutos_ms).toEqual([4000]);
    expect(ata.extracao.pendencias).toHaveLength(1);
    expect(ata.extracao.pendencias[0]).toMatchObject({
      texto: 'Ana cobra a ART.',
      prazo: null,
      prazo_estimado: false,
    });
    expect(ata.extracao.valores[0]!.unidade).toBe('R$');
    expect(ata.extracao.prazos).toEqual([
      { evento: 'Esquadrias', data: '2026-11-13', minuto_ms: null },
    ]);
    expect(ata.extracao.riscos[0]!.gravidade).toBe('media');
  });

  it('aceita aliases comuns de campo (text, descricao, pendencia)', () => {
    const { ata } = normalizarAta({
      extracao: {
        decisoes: [{ text: 'Decidido.' }],
        pendencias: [{ pendencia: 'Fazer X' }],
        riscos: [{ descricao: 'Risco Y' }],
      },
    });
    expect(ata.extracao.decisoes[0]!.texto).toBe('Decidido.');
    expect(ata.extracao.pendencias[0]!.texto).toBe('Fazer X');
    expect(ata.extracao.riscos[0]!.texto).toBe('Risco Y');
  });

  it('entrada vazia ou lixo vira ata vazia válida', () => {
    expect(normalizarAta(null).ata.extracao.decisoes).toEqual([]);
    expect(normalizarAta('x').ata.resumo).toBe('');
  });

  it('o esquema do modelo aceita nulos onde o banco exige valor', () => {
    const ok = AtaLLM.safeParse({
      resumo: '',
      secoes: [],
      extracao: {
        decisoes: [],
        pendencias: [
          { texto: 'a', responsavel: null, prazo: null, prazo_estimado: false, minuto_ms: null },
        ],
        valores: [],
        prazos: [{ evento: 'e', data: null, minuto_ms: null }],
        riscos: [{ texto: 'r', minuto_ms: null, gravidade: null }],
      },
    });
    expect(ok.success).toBe(true);
  });
});
