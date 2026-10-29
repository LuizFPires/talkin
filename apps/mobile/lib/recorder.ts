import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { RecordingSession, UploadQueue, type Chunk, type Moment } from '@talkin/capture';
import { chunkUploader } from './upload';
import { queueStore } from './queue-store';

const TICK_MS = 1000;

type Listeners = {
  onElapsed?: (ms: number) => void;
  onWarn?: () => void;
  onLimit?: () => void;
};

/**
 * Gravador presencial: grava em blocos de ~45 s (para/retoma o expo-av),
 * enfileira cada bloco para upload incremental e marca momentos.
 *
 * LIMITAÇÃO CONHECIDA (teste manual por SO): a troca de bloco para e reinicia
 * o encoder do expo-av, o que deixa um pequeno intervalo sem captura na emenda.
 * Gapless real exige captura nativa contínua (gravador duplo sobreposto),
 * planejada junto do módulo de captura do desktop (M3).
 */
export class MeetingRecorder {
  private session: RecordingSession;
  private queue: UploadQueue;
  private recording: Audio.Recording | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private index = 0;
  private busy = false;
  private stopped = false;

  constructor(
    private readonly organizationId: string,
    private readonly recordingId: string,
    private readonly listeners: Listeners = {},
  ) {
    this.session = new RecordingSession(Date.now());
    this.queue = new UploadQueue(
      chunkUploader(organizationId, recordingId),
      queueStore(recordingId),
    );
  }

  async start(): Promise<void> {
    await this.queue.init();
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    await this.startChunk();
    this.timer = setInterval(() => void this.onTick(), TICK_MS);
  }

  markMoment(label?: Moment['label']): Moment {
    return this.session.markMoment(Date.now(), label);
  }

  getMoments(): readonly Moment[] {
    return this.session.getMoments();
  }

  private async onTick(): Promise<void> {
    if (this.busy || this.stopped) return; // evita rotação/stop concorrentes
    this.busy = true;
    try {
      const now = Date.now();
      this.listeners.onElapsed?.(this.session.elapsedMs(now));
      const { rotate, warn, reachedLimit } = this.session.tick(now);
      if (warn) this.listeners.onWarn?.();
      if (rotate) await this.rotate();
      if (reachedLimit) {
        this.listeners.onLimit?.();
        this.busy = false;
        await this.stop();
        return;
      }
    } finally {
      this.busy = false;
    }
  }

  private async startChunk(): Promise<void> {
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    this.recording = recording;
  }

  /** Fecha o bloco atual, enfileira e abre o próximo (ver LIMITAÇÃO acima). */
  private async rotate(): Promise<void> {
    const chunk = await this.finishChunk();
    if (chunk) {
      await this.queue.add(chunk);
      void this.queue.flush();
    }
    if (!this.stopped) await this.startChunk();
  }

  private async finishChunk(): Promise<Chunk | null> {
    if (!this.recording) return null;
    const rec = this.recording;
    this.recording = null;
    await rec.stopAndUnloadAsync();
    const status = await rec.getStatusAsync();
    const uri = rec.getURI();
    if (!uri) return null;
    const info = await FileSystem.getInfoAsync(uri);
    return {
      index: this.index++,
      localPath: uri,
      durationMs: status.durationMillis ?? 0,
      bytes: info.exists ? (info.size ?? 0) : 0,
    };
  }

  /** Encerra (idempotente): fecha o último bloco, tenta enviar e devolve pendentes. */
  async stop(): Promise<{ pending: number }> {
    if (this.stopped) return { pending: this.queue.pendingCount() };
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const last = await this.finishChunk();
    if (last) await this.queue.add(last);
    const { pending } = await this.queue.flush();
    return { pending };
  }
}
