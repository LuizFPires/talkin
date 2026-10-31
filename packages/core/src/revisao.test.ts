import { describe, expect, it } from 'vitest';
import { AtaContent } from './extraction';
import {
  aplicarEdicao,
  chavesComConteudo,
  chavesRevisao,
  marcarConferida,
  mesclarPreservandoEdicoes,
} from './revisao';

const base = (): AtaContent =>
  AtaContent.parse({
    resumo: 'Resumo da IA.',
    secoes: [{ key: 'contexto', title: 'Contexto', body: 'Texto da IA.', minutos_ms: [1000] }],
    extracao: {
      decisoes: [{ texto: 'Aprovar X', minuto_ms: 2000, quem: null }],
      pendencias: [],
      valores: [{ descricao: 'Impermeabilização', valor: 18500, unidade: 'R$', minuto_ms: null }],
    },
  });

describe('revisão guiada', () => {
  it('AtaContent antigo (sem revisao) ganha o padrão vazio', () => {
    const a = base();
    expect(a.revisao).toEqual({ conferidas: [], editadas: [] });
  });

  it('lista as chaves na ordem da tela e só as com conteúdo contam', () => {
    const a = base();
    expect(chavesRevisao(a)).toEqual([
      'resumo',
      'secao:contexto',
      'decisoes',
      'pendencias',
      'valores',
    ]);
    expect(chavesComConteudo(a)).toEqual(['resumo', 'secao:contexto', 'decisoes', 'valores']);
  });

  it('editar o resumo marca como editado e conferido', () => {
    const a = aplicarEdicao(base(), { tipo: 'texto', chave: 'resumo', texto: '  Corrigido. ' });
    expect(a.resumo).toBe('Corrigido.');
    expect(a.revisao.editadas).toEqual(['resumo']);
    expect(a.revisao.conferidas).toEqual(['resumo']);
  });

  it('editar uma seção do modelo troca só o corpo dela', () => {
    const a = aplicarEdicao(base(), { tipo: 'texto', chave: 'secao:contexto', texto: 'Novo.' });
    expect(a.secoes[0]).toMatchObject({ key: 'contexto', body: 'Novo.', minutos_ms: [1000] });
    expect(() =>
      aplicarEdicao(base(), { tipo: 'texto', chave: 'secao:nada', texto: 'x' }),
    ).toThrow();
  });

  it('editar listas substitui os itens validados', () => {
    const a = aplicarEdicao(base(), {
      tipo: 'pendencias',
      itens: [
        {
          texto: 'Cobrar fornecedor',
          responsavel: 'Marcos',
          prazo: null,
          prazo_estimado: false,
          minuto_ms: null,
        },
      ],
    });
    expect(a.extracao.pendencias).toHaveLength(1);
    expect(a.revisao.editadas).toEqual(['pendencias']);
  });

  it('conferir e desconferir', () => {
    let a = marcarConferida(base(), 'decisoes', true);
    expect(a.revisao.conferidas).toEqual(['decisoes']);
    a = marcarConferida(a, 'decisoes', false);
    expect(a.revisao.conferidas).toEqual([]);
    expect(() => marcarConferida(base(), 'secao:x', true)).toThrow();
  });

  it('regenerar preserva os blocos editados e zera as conferências do resto', () => {
    let anterior = aplicarEdicao(base(), { tipo: 'texto', chave: 'resumo', texto: 'Meu resumo.' });
    anterior = marcarConferida(anterior, 'decisoes', true);
    const nova = base();
    nova.resumo = 'Resumo novo da IA.';
    nova.extracao.decisoes = [{ texto: 'Outra decisão', minuto_ms: null, quem: null }];
    const final = mesclarPreservandoEdicoes(nova, anterior);
    expect(final.resumo).toBe('Meu resumo.');
    expect(final.extracao.decisoes[0]?.texto).toBe('Outra decisão');
    expect(final.revisao).toEqual({ editadas: ['resumo'], conferidas: ['resumo'] });
  });

  it('seção editada que sumiu no modelo novo volta com a edição do usuário', () => {
    const anterior = aplicarEdicao(base(), {
      tipo: 'texto',
      chave: 'secao:contexto',
      texto: 'Meu.',
    });
    const nova = base();
    nova.secoes = [];
    const final = mesclarPreservandoEdicoes(nova, anterior);
    // A seção editada volta (o usuário escreveu nela), então segue listada.
    expect(final.secoes.map((s) => s.key)).toEqual(['contexto']);
    expect(final.revisao.editadas).toEqual(['secao:contexto']);
  });

  it('sem anterior, a nova vem limpa', () => {
    expect(mesclarPreservandoEdicoes(base(), null).revisao).toEqual({
      conferidas: [],
      editadas: [],
    });
  });
});
