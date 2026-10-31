import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  AtaLLM,
  ATA_SYSTEM_PROMPT,
  buildAtaUserPrompt,
  normalizarAta,
  type AtaInput,
  type AtaProvider,
  type AtaResult,
} from '@talkin/core';

/**
 * Geração de ata + extração via Claude com SAÍDA ESTRUTURADA: o modelo fica
 * preso ao esquema `AtaLLM` (não existe mais "campo faltando" ou texto fora do
 * JSON); `normalizarAta` converte para o `AtaContent` estrito, descartando só
 * itens inválidos em vez de derrubar a ata. Erros de rede/5xx são repetidos
 * pelo SDK; um resultado sem conteúdo tenta mais uma vez.
 */
export class AnthropicAtaProvider implements AtaProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;
  // Preço aproximado do Sonnet 5.5 por token (centavos) — ajustar conforme contrato.
  private readonly inCentsPerMTok = 200;
  private readonly outCentsPerMTok = 1000;

  constructor(
    apiKey: string,
    private readonly model = 'claude-sonnet-5-5',
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 3, timeout: 110_000 });
  }

  async generate(input: AtaInput): Promise<AtaResult> {
    let ultimoErro: unknown;
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        return await this.gerarUmaVez(input, tentativa);
      } catch (err) {
        ultimoErro = err;
        // 4xx (chave, modelo, política) não melhora repetindo.
        if (err instanceof Anthropic.APIError && err.status && err.status < 500) break;
      }
    }
    throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro));
  }

  private async gerarUmaVez(input: AtaInput, tentativa: number): Promise<AtaResult> {
    const res = await this.client.messages.parse({
      model: this.model,
      max_tokens: 16000,
      system: ATA_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildAtaUserPrompt(input) }],
      output_config: { format: zodOutputFormat(AtaLLM) },
    });

    if (res.stop_reason === 'refusal') {
      throw new Error(
        `Anthropic recusou a geração (${res.stop_details?.category ?? 'sem categoria'})`,
      );
    }
    if (res.stop_reason === 'max_tokens') {
      throw new Error('Anthropic: ata excedeu o limite de tokens');
    }
    const bruto = res.parsed_output;
    if (!bruto) {
      throw new Error(`Anthropic: resposta sem JSON válido (tentativa ${tentativa + 1})`);
    }
    const { ata } = normalizarAta(bruto);

    const inTok = res.usage.input_tokens ?? 0;
    const outTok = res.usage.output_tokens ?? 0;
    const costCents = Math.round(
      (inTok * this.inCentsPerMTok + outTok * this.outCentsPerMTok) / 1_000_000,
    );
    return { content: ata, costCents };
  }
}
