import type { EmbeddingProvider } from '@talkin/core';

const DIM = 1536;

/** Embeddings via OpenAI (text-embedding-3-small, 1536). */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai';
  readonly dimensions = DIM;
  constructor(
    private readonly apiKey: string,
    private readonly model = 'text-embedding-3-small',
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: texts, dimensions: DIM }),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }
}

/**
 * Embedding determinístico para o modo só-código/testes (sem chave). Não é
 * semântico, mas é estável: o mesmo texto gera sempre o mesmo vetor normalizado.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'mock';
  readonly dimensions = DIM;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => {
      const v = new Array<number>(DIM).fill(0);
      for (let i = 0; i < t.length; i++) {
        v[(t.charCodeAt(i) * 31 + i) % DIM]! += 1;
      }
      const norma = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
      return v.map((x) => x / norma);
    });
  }
}
