import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import {
  RecordingSession,
  UploadQueue,
  type Chunk,
  type ChunkUploader,
  type Moment,
} from '@talkin/capture';
import { supabase } from './supabase';
import { queueStore } from './queue-store';

const TICK_MS = 1000;

/** Sobe um bloco para o Storage da empresa: {org}/{recordingId}/{index}.m4a */
function uploader(organizationId: string, recordingId: string): ChunkUploader {
  return {
    async upload(item: Chunk) {
      const path = `${organizationId}/${recordingId}/${String(item.index).padStart(4, '0')}.m4a`;
      const res = await fetch(item.localPath);
      const bytes = await res.arrayBuffer();
      const { error } = await supabase.storage
        .from('audio')
        .upload(path, bytes, { contentType: 'audio/m4a', upsert: true });
      if (error) throw new Error(error.message);
      await supabase.from('recording_chunks').insert({
        recording_id: recordingId,
        index: item.index,
        storage_path: path,
        duration_s: Math.round(item.durationMs / 1000),
        bytes: item.bytes,
        uploaded_at: new Date().toISOString(),
      });
    },
  };
}

type Listeners = {
  onElapsed?: (ms: number) => void;
  onWarn?: () => void;
  onLimit?: () => void;
};

/**
 * Gravador presencial: grava em blocos de ~45 s (para/retoma o expo-av),
 * enfileira cada bloco para upload incremental e marca momentos.
 */
export class MeetingRecorder {
  private session: RecordingSession;
  private queue: UploadQueue;
  private recording: Audio.Recording | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private index = 0;

  constructor(
    private readonly organizationId: string,
    private readonly recordingId: string,
    private readonly listeners: Listeners = {},
  ) {
    this.session = new RecordingSession(Date.now());
    this.queue = new UploadQueue(uploader(organizationId, recordingId), queueStore(recordingId));
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
    const now = Date.now();
    this.listeners.onElapsed?.(this.session.elapsedMs(now));
    const { rotate, warn, reachedLimit } = this.session.tick(now);
    if (warn) this.listeners.onWarn?.();
    if (rotate) await this.rotate();
    if (reachedLimit) {
      this.listeners.onLimit?.();
      await this.stop();
    }
  }

  private async startChunk(): Promise<void> {
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    this.recording = recording;
  }

  /** Fecha o bloco atual, enfileira e abre o próximo sem perder áudio. */
  private async rotate(): Promise<void> {
    const chunk = await this.finishChunk();
    if (chunk) {
      await this.queue.add(chunk);
      void this.queue.flush();
    }
    await this.startChunk();
  }

  private async finishChunk(): Promise<Chunk | null> {
    if (!this.recording) return null;
    await this.recording.stopAndUnloadAsync();
    const status = await this.recording.getStatusAsync();
    const uri = this.recording.getURI();
    this.recording = null;
    if (!uri) return null;
    const info = await FileSystem.getInfoAsync(uri);
    const chunk: Chunk = {
      index: this.index++,
      localPath: uri,
      durationMs: status.durationMillis ?? 0,
      bytes: info.exists ? (info.size ?? 0) : 0,
    };
    return chunk;
  }

  /** Encerra: fecha o último bloco, garante o envio e devolve os pendentes. */
  async stop(): Promise<{ pending: number }> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const last = await this.finishChunk();
    if (last) await this.queue.add(last);
    const { pending } = await this.queue.flush();
    return { pending };
  }
}
