import { describe, expect, it } from 'vitest';
import type { TranscriptSegment } from '@talkin/core';
import { AnthropicAtaProvider } from '../providers/anthropic';
import { temChave } from './env';

/**
 * Integração REAL com o Claude (pulado sem ANTHROPIC_API_KEY em apps/web/.env.local).
 * Reproduz o cenário de produção: transcrição curta e informal de uma reunião de
 * obra, gerada 5 vezes seguidas. Cada ata tem de validar no esquema estrito.
 * Imprime só contagens e custo (nunca o conteúdo).
 */
const RODAR = temChave('ANTHROPIC_API_KEY');

const seg = (startMs: number, speakerLabel: string, text: string): TranscriptSegment => ({
  speakerLabel,
  track: 'desconhecido',
  startMs,
  endMs: startMs + 4000,
  text,
});

const TRANSCRICAO: TranscriptSegment[] = [
  seg(0, 'Falante 1', 'Bom, vamos começar pelo cronograma do Bloco B.'),
  seg(48000, 'Falante 2', 'A laje do terceiro pavimento atrasou por causa da chuva.'),
  seg(92000, 'Falante 1', 'Então a concretagem fica para doze de novembro, certo?'),
  seg(130000, 'Falante 2', 'Certo. Já avisei a concreteira.'),
  seg(210000, 'Falante 3', 'As esquadrias o fornecedor confirmou entrega em duas semanas.'),
  seg(400000, 'Falante 2', 'O aditivo da impermeabilização ficou em dezoito mil e quinhentos.'),
  seg(430000, 'Falante 1', 'Aprovado, pode seguir.'),
  seg(580000, 'Falante 3', 'Marcos, você manda o cronograma revisado até sexta?'),
  seg(596000, 'Falante 2', 'Mando sim.'),
  seg(665000, 'Falante 1', 'Ana, fica com você cobrar a ART do engenheiro de solos.'),
];

// Caso mínimo e "ruim": o que o usuário disse no teste de produção (curto, sem estrutura).
const CURTA: TranscriptSegment[] = [
  seg(0, 'Falante 1', 'Vamos ver se agora vai. Testando, um, dois, três.'),
  seg(
    5000,
    'Falante 1',
    'Setecentos, oitocentos e quarenta e três. Onde vamos tratar da do estudo.',
  ),
];

describe.skipIf(!RODAR)('ata com Claude real', () => {
  const provider = new AnthropicAtaProvider(
    process.env.ANTHROPIC_API_KEY!,
    process.env.ANTHROPIC_MODEL,
  );
  const secoes = [
    { key: 'resumo', title: 'Resumo' },
    { key: 'decisoes', title: 'Decisões' },
    { key: 'pendencias', title: 'Pendências' },
  ];

  it(
    '5 gerações seguidas da reunião de obra validam no esquema',
    { timeout: 300_000 },
    async () => {
      for (let i = 0; i < 5; i++) {
        const t0 = Date.now();
        const r = await provider.generate({
          templateKey: 'reuniao_obra',
          templateSections: secoes,
          segments: TRANSCRICAO,
        });
        const ex = r.content.extracao;
        console.log(
          `[ata ${i + 1}/5] ${Date.now() - t0}ms · ${r.costCents}c · secoes=${r.content.secoes.length} dec=${ex.decisoes.length} pend=${ex.pendencias.length} val=${ex.valores.length} prazos=${ex.prazos.length} riscos=${ex.riscos.length}`,
        );
        expect(r.content.resumo.length).toBeGreaterThan(20);
        expect(ex.decisoes.length + ex.pendencias.length).toBeGreaterThan(0);
        for (const p of ex.pendencias) expect(p.texto.length).toBeGreaterThan(0);
      }
    },
  );

  it(
    'transcrição curta e sem conteúdo gera ata válida (sem inventar)',
    { timeout: 120_000 },
    async () => {
      const r = await provider.generate({
        templateKey: 'generico',
        templateSections: secoes,
        segments: CURTA,
      });
      console.log(
        `[ata curta] ${r.costCents}c · dec=${r.content.extracao.decisoes.length} pend=${r.content.extracao.pendencias.length}`,
      );
      expect(typeof r.content.resumo).toBe('string');
    },
  );
});
