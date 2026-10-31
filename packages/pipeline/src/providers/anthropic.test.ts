import { describe, expect, it } from 'vitest';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { AtaLLM } from '@talkin/core';

type Node = {
  type?: string | string[];
  properties?: Record<string, Node>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Node;
  anyOf?: Node[];
};

function* objetos(n: Node): Generator<Node> {
  if (n.type === 'object' || n.properties) yield n;
  for (const p of Object.values(n.properties ?? {})) yield* objetos(p);
  if (n.items) yield* objetos(n.items);
  for (const a of n.anyOf ?? []) yield* objetos(a);
}

/**
 * Garante que o esquema enviado à API de saída estruturada é o que ela aceita:
 * todo objeto fechado (additionalProperties: false) com todas as chaves em
 * `required` — assim o modelo nunca devolve "campo faltando" (o erro visto em
 * produção, `pendencias[0].texto` undefined).
 */
describe('esquema de saída estruturada da ata', () => {
  it('todo objeto é fechado e com todas as chaves obrigatórias', () => {
    const f = zodOutputFormat(AtaLLM) as unknown as { type: string; schema: Node };
    expect(f.type).toBe('json_schema');
    let n = 0;
    for (const o of objetos(f.schema)) {
      n++;
      const chaves = Object.keys(o.properties ?? {});
      expect(o.additionalProperties).toBe(false);
      expect([...(o.required ?? [])].sort()).toEqual([...chaves].sort());
    }
    expect(n).toBeGreaterThanOrEqual(8); // raiz, seção, extração, 5 tipos de item
    const pend = f.schema.properties!.extracao!.properties!.pendencias!.items!;
    expect(pend.required).toContain('texto');
  });
});
