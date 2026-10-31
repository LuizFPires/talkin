import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DeepgramProvider } from '../providers/deepgram';
import { AnthropicAtaProvider } from '../providers/anthropic';
import { temChave } from './env';

/**
 * Integração REAL do caminho batch (Importar / fallback sem ao vivo):
 * áudio pt-BR sintetizado (fixtures/audio) → Deepgram (diarização) → Claude (ata).
 * Pulado sem DEEPGRAM_API_KEY/ANTHROPIC_API_KEY. Só contagens no log.
 */
const AUDIO = resolve(__dirname, '../../../../fixtures/audio/reuniao-obra-pt-br.wav');
const RODAR = temChave('DEEPGRAM_API_KEY') && temChave('ANTHROPIC_API_KEY') && existsSync(AUDIO);

describe.skipIf(!RODAR)('pipeline batch real: áudio → transcrição → ata', () => {
  it('transcreve o áudio de teste e gera a ata', { timeout: 300_000 }, async () => {
    const dg = new DeepgramProvider(process.env.DEEPGRAM_API_KEY!);
    const t0 = Date.now();
    const tr = await dg.transcribe({ audioPath: AUDIO });
    console.log(
      `[deepgram] ${Date.now() - t0}ms · ${tr.costCents}c · trechos=${tr.segments.length} falantes=${new Set(tr.segments.map((s) => s.speakerLabel)).size}`,
    );
    expect(tr.segments.length).toBeGreaterThan(3);
    const texto = tr.segments
      .map((s) => s.text)
      .join(' ')
      .toLowerCase();
    // Palavras ditas no áudio sintetizado (fixtures/audio/reuniao-obra-pt-br.wav)
    expect(texto).toMatch(/concretagem|esquadrias|aditivo/);

    const ata = new AnthropicAtaProvider(
      process.env.ANTHROPIC_API_KEY!,
      process.env.ANTHROPIC_MODEL,
    );
    const t1 = Date.now();
    const r = await ata.generate({
      templateKey: 'reuniao_obra',
      templateSections: [
        { key: 'resumo', title: 'Resumo' },
        { key: 'decisoes', title: 'Decisões' },
        { key: 'pendencias', title: 'Pendências' },
      ],
      segments: tr.segments,
    });
    const ex = r.content.extracao;
    console.log(
      `[ata] ${Date.now() - t1}ms · ${r.costCents}c · dec=${ex.decisoes.length} pend=${ex.pendencias.length} val=${ex.valores.length} prazos=${ex.prazos.length} riscos=${ex.riscos.length}`,
    );
    expect(ex.pendencias.length).toBeGreaterThan(0);
    expect(ex.valores.some((v) => Math.round(v.valor) === 18500)).toBe(true);
  });
});
