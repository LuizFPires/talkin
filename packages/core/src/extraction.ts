import { z } from 'zod';

/**
 * Extração estruturada da reunião (SPEC 11). Toda saída da IA passa por este
 * schema antes de salvar; o que falhar não é gravado e vai para "Revisar".
 */

/** Minuto de origem no áudio, em ms (vira pílula mono na UI). */
const minute = z.number().int().nonnegative();

export const Decisao = z.object({
  texto: z.string().min(1),
  minuto_ms: minute.nullable(),
  quem: z.string().nullable(),
});
export type Decisao = z.infer<typeof Decisao>;

export const PendenciaExtraida = z.object({
  texto: z.string().min(1),
  responsavel: z.string().nullable(),
  prazo: z.string().date().nullable(),
  prazo_estimado: z.boolean().default(false),
  minuto_ms: minute.nullable(),
});
export type PendenciaExtraida = z.infer<typeof PendenciaExtraida>;

export const ValorCitado = z.object({
  descricao: z.string().min(1),
  valor: z.number(),
  unidade: z.string(), // R$, R$/m³, m², dias…
  minuto_ms: minute.nullable(),
});
export type ValorCitado = z.infer<typeof ValorCitado>;

export const PrazoData = z.object({
  evento: z.string().min(1),
  data: z.string().date(),
  minuto_ms: minute.nullable(),
});
export type PrazoData = z.infer<typeof PrazoData>;

export const Risco = z.object({
  texto: z.string().min(1),
  minuto_ms: minute.nullable(),
  gravidade: z.enum(['baixa', 'media', 'alta']).default('media'),
});
export type Risco = z.infer<typeof Risco>;

export const Extracao = z.object({
  decisoes: z.array(Decisao).default([]),
  pendencias: z.array(PendenciaExtraida).default([]),
  valores: z.array(ValorCitado).default([]),
  prazos: z.array(PrazoData).default([]),
  riscos: z.array(Risco).default([]),
});
export type Extracao = z.infer<typeof Extracao>;

/** Uma seção da ata; cada frase guarda os minutos de origem (clicar e ouvir). */
export const AtaSecao = z.object({
  key: z.string(),
  title: z.string(),
  body: z.string(),
  minutos_ms: z.array(minute).default([]),
});
export type AtaSecao = z.infer<typeof AtaSecao>;

/**
 * Estado da revisão guiada (SPEC 12): quais blocos o usuário conferiu (✓) e quais
 * editou. Chaves: `resumo`, `secao:<key>`, `decisoes`, `pendencias`, `valores`.
 * Blocos editados são preservados quando a ata é regenerada.
 */
export const Revisao = z.object({
  conferidas: z.array(z.string()).default([]),
  editadas: z.array(z.string()).default([]),
});
export type Revisao = z.infer<typeof Revisao>;

/** Conteúdo da ata salvo em summaries.content. */
export const AtaContent = z.object({
  resumo: z.string().default(''),
  secoes: z.array(AtaSecao).default([]),
  extracao: Extracao,
  revisao: Revisao.default({ conferidas: [], editadas: [] }),
});
export type AtaContent = z.infer<typeof AtaContent>;
