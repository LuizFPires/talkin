import { describe, expect, it } from 'vitest';
import { agruparPalavras } from './deepgram';

/** Gera palavras contínuas (0,4 s cada) com pontuação final a cada `porFrase` palavras. */
function palavras(n: number, porFrase: number, speaker = 0, inicioS = 0) {
  return Array.from({ length: n }, (_, i) => {
    const start = inicioS + i * 0.4;
    const fim = (i + 1) % porFrase === 0 ? '.' : '';
    return { word: `p${i}`, punctuated_word: `p${i}${fim}`, start, end: start + 0.35, speaker };
  });
}

describe('agruparPalavras (batch)', () => {
  it('monólogo longo vira vários trechos curtos, fechando na pontuação após ~8 s', () => {
    const segs = agruparPalavras(palavras(200, 10)); // 80 s, frase a cada 4 s
    expect(segs.length).toBeGreaterThanOrEqual(6);
    for (const s of segs) expect(s.endMs - s.startMs).toBeLessThanOrEqual(25_000);
    expect(segs.map((s) => s.text).join(' ')).toContain('p199.');
    // começa onde o anterior termina (sem perder palavras)
    expect(segs[0]!.startMs).toBe(0);
  });

  it('sem pontuação, respeita o teto de 25 s', () => {
    const segs = agruparPalavras(palavras(150, 10_000));
    for (const s of segs) expect(s.endMs - s.startMs).toBeLessThanOrEqual(25_000);
    expect(segs.length).toBeGreaterThanOrEqual(2);
  });

  it('quebra na troca de falante e na pausa longa', () => {
    const a = palavras(5, 100, 0, 0);
    const b = palavras(5, 100, 1, 2); // outro falante
    const c = palavras(5, 100, 1, 10); // mesmo falante, pausa de ~6 s
    const segs = agruparPalavras([...a, ...b, ...c]);
    expect(segs.map((s) => s.speakerLabel)).toEqual(['Falante 1', 'Falante 2', 'Falante 2']);
  });
});
