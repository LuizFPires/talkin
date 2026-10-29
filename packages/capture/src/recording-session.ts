import type { Moment } from './types';

export type SessionOptions = {
  /** Duração de cada bloco (SPEC 1: 30–60 s). */
  chunkMs?: number;
  /** Duração máxima da gravação (SPEC 1: 4 h). */
  maxDurationMs?: number;
  /** Aviso antes do limite (SPEC 1: 3h45). */
  warnBeforeMs?: number;
};

const CHUNK = 45_000;
const MAX = 4 * 60 * 60_000;
const WARN = 15 * 60_000;

/**
 * Máquina de estado pura da gravação (sem timers nem RN): a camada nativa
 * chama `tick(now)` periodicamente e reage ao que ela devolve.
 */
export class RecordingSession {
  readonly startedAt: number;
  private lastChunkAt: number;
  private readonly chunkMs: number;
  private readonly maxDurationMs: number;
  private readonly warnBeforeMs: number;
  private readonly moments: Moment[] = [];
  private warned = false;

  constructor(now: number, opts: SessionOptions = {}) {
    this.startedAt = now;
    this.lastChunkAt = now;
    this.chunkMs = opts.chunkMs ?? CHUNK;
    this.maxDurationMs = opts.maxDurationMs ?? MAX;
    this.warnBeforeMs = opts.warnBeforeMs ?? WARN;
  }

  elapsedMs(now: number): number {
    return now - this.startedAt;
  }

  /** Marca um momento importante (vira destaque na ata). */
  markMoment(now: number, label?: Moment['label']): Moment {
    const m: Moment = { atMs: now - this.startedAt, label };
    this.moments.push(m);
    return m;
  }

  getMoments(): readonly Moment[] {
    return this.moments;
  }

  /** O que a camada nativa deve fazer neste instante. */
  tick(now: number): { rotate: boolean; warn: boolean; reachedLimit: boolean } {
    const rotate = now - this.lastChunkAt >= this.chunkMs;
    if (rotate) this.lastChunkAt = now;

    const elapsed = this.elapsedMs(now);
    const warn = !this.warned && elapsed >= this.maxDurationMs - this.warnBeforeMs;
    if (warn) this.warned = true;

    return { rotate, warn, reachedLimit: elapsed >= this.maxDurationMs };
  }
}
