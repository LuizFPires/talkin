import { describe, expect, it } from 'vitest';
import type { AtaContent, TranscriptionResult } from '@talkin/core';
import { processRecording, PipelineError } from './pipeline';
import type { PipelinePorts, Providers } from './ports';
import { MockAtaProvider, MockTranscriptionProvider } from './providers/mock';
import { MockEmbeddingProvider } from './providers/embedding';

function makePorts() {
  const state = {
    status: [] as string[],
    jobs: [] as string[],
    summary: null as AtaContent | null,
    actionItems: 0,
    cost: { transcriptionCents: -1, aiCents: -1 },
  };
  const ports: PipelinePorts = {
    async setStatus(_id, status) {
      state.status.push(status);
    },
    async upsertJob(_id, step, status) {
      state.jobs.push(`${step}:${status}`);
    },
    async prepareAudio() {
      return '/tmp/fake.m4a';
    },
    async saveTranscript(_id, result: TranscriptionResult) {
      return {
        transcriptId: 't1',
        speakerIdByLabel: Object.fromEntries(
          result.segments.map((s, i) => [s.speakerLabel, `sp${i}`]),
        ),
      };
    },
    async getTemplate() {
      return {
        templateId: 'tpl1',
        key: 'generico',
        sections: [{ key: 'resumo', title: 'Resumo' }],
      };
    },
    async getContext() {
      return { projectName: 'Galpão A' };
    },
    async getSegments() {
      return [
        {
          speakerLabel: 'Falante 1',
          track: 'desconhecido' as const,
          startMs: 0,
          endMs: 4000,
          text: 'oi',
        },
      ];
    },
    async saveSummary(_id, _tpl, content) {
      state.summary = content;
      return 's1';
    },
    async saveActionItems(_id, _summaryId, content) {
      state.actionItems = content.extracao.pendencias.length;
    },
    async addCost(_id, cost) {
      state.cost = cost;
    },
    async addAiCost(_id, cents) {
      state.cost = { ...state.cost, aiCents: state.cost.aiCents + cents };
    },
    async listSegmentRows() {
      return [{ id: 'seg1', text: 'oi' }];
    },
    async saveEmbeddings() {},
  };
  return { ports, state };
}

const providers: Providers = {
  transcription: new MockTranscriptionProvider(),
  ata: new MockAtaProvider(),
  embedding: new MockEmbeddingProvider(),
};

describe('processRecording', () => {
  it('percorre as etapas e termina em "pronto"', async () => {
    const { ports, state } = makePorts();
    await processRecording('rec1', ports, providers);

    expect(state.status).toEqual([
      'transcrevendo',
      'segmentando',
      'resumindo',
      'extraindo',
      'pronto',
    ]);
    expect(state.jobs).toContain('transcribe:done');
    expect(state.jobs).toContain('summarize:done');
    expect(state.jobs).toContain('embed:done');
    expect(state.summary?.resumo).toContain('galpão');
    expect(state.actionItems).toBe(1);
    expect(state.cost.transcriptionCents).toBe(0);
  });

  it('marca "erro" e lança PipelineError quando uma etapa falha', async () => {
    const { ports, state } = makePorts();
    const boom: Providers = {
      transcription: {
        name: 'boom',
        async transcribe() {
          throw new Error('falha de rede');
        },
      },
      ata: new MockAtaProvider(),
      embedding: new MockEmbeddingProvider(),
    };
    await expect(processRecording('rec1', ports, boom)).rejects.toBeInstanceOf(PipelineError);
    expect(state.status.at(-1)).toBe('erro');
  });
});
