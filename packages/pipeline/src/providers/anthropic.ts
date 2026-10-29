import {
  AtaContent,
  ATA_SYSTEM_PROMPT,
  buildAtaUserPrompt,
  type AtaInput,
  type AtaProvider,
  type AtaResult,
} from '@talkin/core';

/** Geração de ata + extração via Claude (Messages API). */
export class AnthropicAtaProvider implements AtaProvider {
  readonly name = 'anthropic';
  // Preço aproximado do Sonnet 5.5 por token (centavos) — ajustar conforme contrato.
  private readonly inCentsPerMTok = 300;
  private readonly outCentsPerMTok = 1500;

  constructor(
    private readonly apiKey: string,
    private readonly model = 'claude-sonnet-5-5',
  ) {}

  async generate(input: AtaInput): Promise<AtaResult> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system: ATA_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildAtaUserPrompt(input) }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = (json.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
    const content = AtaContent.parse(parseJson(text));

    const inTok = json.usage?.input_tokens ?? 0;
    const outTok = json.usage?.output_tokens ?? 0;
    const costCents = Math.round(
      (inTok * this.inCentsPerMTok + outTok * this.outCentsPerMTok) / 1_000_000,
    );

    return { content, costCents };
  }
}

/** Extrai o JSON da resposta, tolerando cercas de código. */
function parseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1]! : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('resposta da IA sem JSON');
  return JSON.parse(raw.slice(start, end + 1));
}
