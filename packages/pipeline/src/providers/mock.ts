import type {
  AtaInput,
  AtaProvider,
  AtaResult,
  TranscribeInput,
  TranscriptionProvider,
  TranscriptionResult,
} from '@talkin/core';

/**
 * Provedores determinísticos para o modo só-código (sem chaves) e para testes.
 * Não chamam rede: devolvem uma transcrição/ata sintética coerente.
 */
export class MockTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'mock';
  async transcribe(_input: TranscribeInput): Promise<TranscriptionResult> {
    return {
      language: 'pt-BR',
      provider: this.name,
      costCents: 0,
      segments: [
        {
          speakerLabel: 'Falante 1',
          track: 'desconhecido',
          startMs: 0,
          endMs: 4000,
          text: 'Precisamos definir o prazo da estrutura do galpão.',
        },
        {
          speakerLabel: 'Falante 2',
          track: 'desconhecido',
          startMs: 4000,
          endMs: 9000,
          text: 'Fechamos a concretagem para sexta, dia 30/10, com o fornecedor.',
        },
      ],
    };
  }
}

export class MockAtaProvider implements AtaProvider {
  readonly name = 'mock';
  async generate(input: AtaInput): Promise<AtaResult> {
    const primeiroMinuto = input.segments[0]?.startMs ?? 0;
    return {
      costCents: 0,
      content: {
        resumo: 'Reunião tratou do prazo da estrutura e da concretagem do galpão.',
        secoes: [
          {
            key: input.templateSections[0]?.key ?? 'resumo',
            title: input.templateSections[0]?.title ?? 'Resumo',
            body: 'Definida a concretagem para sexta-feira.',
            minutos_ms: [primeiroMinuto],
          },
        ],
        extracao: {
          decisoes: [
            { texto: 'Concretagem marcada para 30/10.', minuto_ms: 4000, quem: 'Falante 2' },
          ],
          pendencias: [
            {
              texto: 'Confirmar prazo da estrutura do galpão.',
              responsavel: null,
              prazo: null,
              prazo_estimado: false,
              minuto_ms: 0,
            },
          ],
          valores: [],
          prazos: [{ evento: 'Concretagem', data: '2026-10-30', minuto_ms: 4000 }],
          riscos: [],
        },
      },
    };
  }
}
