import { describe, expect, it } from 'vitest';
import { RecordingSession } from './recording-session';

describe('RecordingSession', () => {
  it('rotaciona um bloco a cada chunkMs', () => {
    const s = new RecordingSession(0, { chunkMs: 45_000, maxDurationMs: 4 * 60 * 60_000 });
    expect(s.tick(10_000).rotate).toBe(false);
    expect(s.tick(45_000).rotate).toBe(true);
    expect(s.tick(50_000).rotate).toBe(false);
    expect(s.tick(90_000).rotate).toBe(true);
  });

  it('marca momentos relativos ao início', () => {
    const s = new RecordingSession(1_000);
    const m = s.markMoment(61_000, 'decisao');
    expect(m.atMs).toBe(60_000);
    expect(m.label).toBe('decisao');
    expect(s.getMoments()).toHaveLength(1);
  });

  it('avisa antes do limite e sinaliza quando atinge 4 h', () => {
    const s = new RecordingSession(0, {
      maxDurationMs: 4 * 60 * 60_000,
      warnBeforeMs: 15 * 60_000,
    });
    expect(s.tick(3 * 60 * 60_000).warn).toBe(false);
    expect(s.tick((3 * 60 + 45) * 60_000).warn).toBe(true); // 3h45
    expect(s.tick((3 * 60 + 50) * 60_000).warn).toBe(false); // avisa só uma vez
    expect(s.tick(4 * 60 * 60_000).reachedLimit).toBe(true);
  });
});
