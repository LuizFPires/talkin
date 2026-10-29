import { describe, expect, it } from 'vitest';
import { formatBRL, formatBRLFromCents, formatDateBR, formatMinute } from './format';
import { toLibraryStatus } from './enums';

describe('formatação brasileira', () => {
  it('formata centavos em R$', () => {
    expect(formatBRLFromCents(123456)).toBe('R$ 1.234,56');
  });

  it('formata reais em R$', () => {
    expect(formatBRL(512)).toBe('R$ 512,00');
  });

  it('formata data em dd/mm/aaaa', () => {
    expect(formatDateBR('2026-10-29T12:00:00-03:00')).toBe('29/10/2026');
  });

  it('formata minuto em mm:ss e h:mm:ss', () => {
    expect(formatMinute(42_000)).toBe('00:42');
    expect(formatMinute(3_661_000)).toBe('1:01:01');
  });
});

describe('status da biblioteca', () => {
  it('agrupa etapas do pipeline em "processando"', () => {
    expect(toLibraryStatus('transcrevendo')).toBe('processando');
    expect(toLibraryStatus('resumindo')).toBe('processando');
    expect(toLibraryStatus('pronto')).toBe('pronto');
    expect(toLibraryStatus('erro')).toBe('erro');
    expect(toLibraryStatus('gravando')).toBe('gravando');
  });
});
