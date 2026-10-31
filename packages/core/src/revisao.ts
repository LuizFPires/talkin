import { z } from 'zod';
import { AtaContent, Decisao, PendenciaExtraida, ValorCitado } from './extraction';

/**
 * Revisão guiada da ata (SPEC 12). Funções puras sobre o `AtaContent`:
 * - chaves dos blocos revisáveis (`resumo`, `secao:<key>`, `decisoes`, `pendencias`, `valores`);
 * - aplicar uma edição do usuário a um bloco (valida o valor pelo schema do bloco);
 * - marcar um bloco como conferido;
 * - mesclar uma ata regenerada preservando os blocos editados pelo usuário.
 */

export const CHAVES_FIXAS = ['resumo', 'decisoes', 'pendencias', 'valores'] as const;

/** Chaves dos blocos revisáveis desta ata, na ordem em que aparecem na tela. */
export function chavesRevisao(ata: AtaContent): string[] {
  return [
    'resumo',
    ...ata.secoes.map((s) => `secao:${s.key}`),
    'decisoes',
    'pendencias',
    'valores',
  ];
}

/** Blocos que existem na ata (sem lista vazia): são os que contam para o progresso. */
export function chavesComConteudo(ata: AtaContent): string[] {
  return chavesRevisao(ata).filter((c) => {
    if (c === 'resumo') return ata.resumo.trim().length > 0;
    if (c === 'decisoes') return ata.extracao.decisoes.length > 0;
    if (c === 'pendencias') return ata.extracao.pendencias.length > 0;
    if (c === 'valores') return ata.extracao.valores.length > 0;
    return true;
  });
}

/** Edição enviada pela tela: o valor depende do bloco. */
export const EdicaoBloco = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('texto'), chave: z.string().min(1), texto: z.string().max(20_000) }),
  z.object({ tipo: z.literal('decisoes'), itens: z.array(Decisao).max(200) }),
  z.object({ tipo: z.literal('pendencias'), itens: z.array(PendenciaExtraida).max(200) }),
  z.object({ tipo: z.literal('valores'), itens: z.array(ValorCitado).max(200) }),
]);
export type EdicaoBloco = z.infer<typeof EdicaoBloco>;

function unico(lista: string[], chave: string): string[] {
  return lista.includes(chave) ? lista : [...lista, chave];
}

/** Aplica a edição e marca o bloco como editado e conferido. Devolve uma ata nova. */
export function aplicarEdicao(ata: AtaContent, ed: EdicaoBloco): AtaContent {
  const revisao = { ...ata.revisao };
  let chave: string;
  let proxima: AtaContent;
  if (ed.tipo === 'texto') {
    chave = ed.chave;
    const texto = ed.texto.trim();
    if (chave === 'resumo') {
      proxima = { ...ata, resumo: texto };
    } else if (chave.startsWith('secao:')) {
      const key = chave.slice('secao:'.length);
      if (!ata.secoes.some((s) => s.key === key)) throw new Error('seção inexistente');
      proxima = {
        ...ata,
        secoes: ata.secoes.map((s) => (s.key === key ? { ...s, body: texto } : s)),
      };
    } else {
      throw new Error('bloco de texto inválido');
    }
  } else {
    chave = ed.tipo;
    proxima = { ...ata, extracao: { ...ata.extracao, [ed.tipo]: ed.itens } };
  }
  proxima.revisao = {
    editadas: unico(revisao.editadas, chave),
    conferidas: unico(revisao.conferidas, chave),
  };
  return proxima;
}

/** Marca/desmarca um bloco como conferido (✓). */
export function marcarConferida(ata: AtaContent, chave: string, ok: boolean): AtaContent {
  if (!chavesRevisao(ata).includes(chave)) throw new Error('bloco inexistente');
  const conferidas = ok
    ? unico(ata.revisao.conferidas, chave)
    : ata.revisao.conferidas.filter((c) => c !== chave);
  return { ...ata, revisao: { ...ata.revisao, conferidas } };
}

/**
 * Ata regenerada pela IA + ata anterior → ata final. Cada bloco editado pelo
 * usuário vem da anterior; o resto vem da nova. Conferidas reiniciam (o conteúdo
 * novo precisa ser lido de novo), exceto as editadas, que seguem conferidas.
 */
export function mesclarPreservandoEdicoes(
  nova: AtaContent,
  anterior: AtaContent | null,
): AtaContent {
  if (!anterior || anterior.revisao.editadas.length === 0) {
    return { ...nova, revisao: { conferidas: [], editadas: [] } };
  }
  const editadas = anterior.revisao.editadas;
  let out: AtaContent = { ...nova, extracao: { ...nova.extracao } };
  for (const chave of editadas) {
    if (chave === 'resumo') out.resumo = anterior.resumo;
    else if (chave === 'decisoes') out.extracao.decisoes = anterior.extracao.decisoes;
    else if (chave === 'pendencias') out.extracao.pendencias = anterior.extracao.pendencias;
    else if (chave === 'valores') out.extracao.valores = anterior.extracao.valores;
    else if (chave.startsWith('secao:')) {
      const key = chave.slice('secao:'.length);
      const velha = anterior.secoes.find((s) => s.key === key);
      if (!velha) continue; // o modelo novo não tem essa seção: a edição não se aplica
      out = {
        ...out,
        secoes: out.secoes.some((s) => s.key === key)
          ? out.secoes.map((s) => (s.key === key ? velha : s))
          : [...out.secoes, velha],
      };
    }
  }
  const presentes = chavesRevisao(out);
  const mantidas = editadas.filter((c) => presentes.includes(c));
  out.revisao = { editadas: mantidas, conferidas: mantidas };
  return out;
}
