// O esquema do modelo usa o zod v4 (subcaminho do zod 3.25) porque o helper de
// saída estruturada do SDK da Anthropic espera os tipos v4. O resto do core
// segue no v3 até a migração completa.
import { z } from 'zod/v4';
import { AtaContent } from './extraction';

/**
 * Esquema que o MODELO preenche (saída estruturada). É mais relaxado que o
 * `AtaContent` salvo no banco: tudo obrigatório mas anulável, sem `default`,
 * sem formato de data (o modelo às vezes devolve "" ou "sexta-feira"). A
 * `normalizarAta` converte para o `AtaContent` estrito, descartando só o item
 * inválido em vez de derrubar a ata inteira.
 */
const minutoLLM = z.number().nullable();

export const AtaLLM = z.object({
  resumo: z.string(),
  secoes: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      body: z.string(),
      minutos_ms: z.array(z.number()),
    }),
  ),
  extracao: z.object({
    decisoes: z.array(
      z.object({ texto: z.string(), minuto_ms: minutoLLM, quem: z.string().nullable() }),
    ),
    pendencias: z.array(
      z.object({
        texto: z.string(),
        responsavel: z.string().nullable(),
        prazo: z.string().nullable(),
        prazo_estimado: z.boolean(),
        minuto_ms: minutoLLM,
      }),
    ),
    valores: z.array(
      z.object({
        descricao: z.string(),
        valor: z.number(),
        unidade: z.string(),
        minuto_ms: minutoLLM,
      }),
    ),
    prazos: z.array(
      z.object({ evento: z.string(), data: z.string().nullable(), minuto_ms: minutoLLM }),
    ),
    riscos: z.array(
      z.object({
        texto: z.string(),
        minuto_ms: minutoLLM,
        gravidade: z.enum(['baixa', 'media', 'alta']).nullable(),
      }),
    ),
  }),
});
export type AtaLLM = z.infer<typeof AtaLLM>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function dataOuNula(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (ISO_DATE.test(s) && !Number.isNaN(Date.parse(s))) return s;
  // dd/mm/aaaa (o modelo às vezes usa o formato do texto nos campos)
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (br) {
    const iso = `${br[3]}-${br[2]}-${br[1]}`;
    if (!Number.isNaN(Date.parse(iso))) return iso;
  }
  return null;
}

function minutoOuNulo(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
}

function textoOuVazio(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function textoOuNulo(v: unknown): string | null {
  const t = textoOuVazio(v);
  return t ? t : null;
}

/**
 * Converte a saída do modelo (ou qualquer JSON parecido) no `AtaContent`
 * estrito. Regras: item sem texto é descartado; data inválida vira nula (e a
 * pendência fica "sem prazo"); minuto negativo/ausente vira nulo; `prazos` com
 * data inválida são descartados (a data é o próprio dado). Devolve também o
 * que foi descartado, para registro de custo/qualidade sem conteúdo sensível.
 */
export function normalizarAta(bruto: unknown): { ata: AtaContent; descartados: number } {
  const b = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
  const ex = (b.extracao && typeof b.extracao === 'object' ? b.extracao : {}) as Record<
    string,
    unknown
  >;
  let descartados = 0;
  const lista = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [];

  const secoes = lista(b.secoes).flatMap((s) => {
    const key = textoOuVazio(s.key);
    const title = textoOuVazio(s.title);
    if (!key && !title) return [];
    return [
      {
        key: key || title.toLowerCase().replace(/\s+/g, '_'),
        title: title || key,
        body: textoOuVazio(s.body),
        minutos_ms: (Array.isArray(s.minutos_ms) ? s.minutos_ms : [])
          .map(minutoOuNulo)
          .filter((m): m is number => m !== null),
      },
    ];
  });

  const decisoes = lista(ex.decisoes).flatMap((d) => {
    const texto = textoOuVazio(d.texto ?? d.text ?? d.decisao ?? d.descricao);
    if (!texto) return descartados++, [];
    return [{ texto, minuto_ms: minutoOuNulo(d.minuto_ms), quem: textoOuNulo(d.quem) }];
  });

  const pendencias = lista(ex.pendencias).flatMap((p) => {
    const texto = textoOuVazio(p.texto ?? p.text ?? p.pendencia ?? p.descricao ?? p.tarefa);
    if (!texto) return descartados++, [];
    const prazo = dataOuNula(p.prazo);
    return [
      {
        texto,
        responsavel: textoOuNulo(p.responsavel),
        prazo,
        prazo_estimado: Boolean(p.prazo_estimado) && prazo !== null,
        minuto_ms: minutoOuNulo(p.minuto_ms),
      },
    ];
  });

  const valores = lista(ex.valores).flatMap((v) => {
    const descricao = textoOuVazio(v.descricao ?? v.texto ?? v.item);
    const valor = typeof v.valor === 'number' && Number.isFinite(v.valor) ? v.valor : null;
    if (!descricao || valor === null) return descartados++, [];
    return [
      {
        descricao,
        valor,
        unidade: textoOuVazio(v.unidade) || 'R$',
        minuto_ms: minutoOuNulo(v.minuto_ms),
      },
    ];
  });

  const prazos = lista(ex.prazos).flatMap((p) => {
    const evento = textoOuVazio(p.evento ?? p.texto ?? p.descricao);
    const data = dataOuNula(p.data ?? p.prazo);
    if (!evento || !data) return descartados++, [];
    return [{ evento, data, minuto_ms: minutoOuNulo(p.minuto_ms) }];
  });

  const riscos = lista(ex.riscos).flatMap((r) => {
    const texto = textoOuVazio(r.texto ?? r.text ?? r.risco ?? r.descricao);
    if (!texto) return descartados++, [];
    const g = r.gravidade;
    return [
      {
        texto,
        minuto_ms: minutoOuNulo(r.minuto_ms),
        gravidade: g === 'baixa' || g === 'alta' ? g : ('media' as const),
      },
    ];
  });

  const ata = AtaContent.parse({
    resumo: textoOuVazio(b.resumo),
    secoes,
    extracao: { decisoes, pendencias, valores, prazos, riscos },
  });
  return { ata, descartados };
}
