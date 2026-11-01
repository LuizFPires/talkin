/** Bot de reunião (SPEC 22): entra na reunião, grava e sai. Opcional. */

export type BotPlatform = 'meet' | 'teams' | 'zoom';
export type BotStatus = 'agendado' | 'entrando' | 'gravando' | 'saiu' | 'erro';

export type ScheduleBotInput = {
  meetingUrl: string;
  platform: BotPlatform;
  /** Nome exibido do bot na reunião (nunca oculto). */
  displayName?: string;
  /** Id interno do bot (vai em `metadata`, volta nos webhooks). */
  referencia?: string;
};

export type ScheduleBotResult = {
  providerBotId: string;
  status: BotStatus;
};

/** Gravação pronta no provedor, para baixar e entrar no pipeline. */
export type BotRecordingMedia = {
  /** URL temporária do áudio (ou vídeo) misturado da reunião. */
  downloadUrl: string;
  /** mp3 | mp4 — define a extensão do bloco salvo. */
  formato: 'mp3' | 'mp4';
  startedAt: string | null;
  completedAt: string | null;
};

/** Provedor de bot (Recall.ai, mock). */
export interface BotProvider {
  readonly name: string;
  scheduleBot(input: ScheduleBotInput): Promise<ScheduleBotResult>;
  stopBot(providerBotId: string): Promise<void>;
  /** Mídia da reunião depois que o bot sai; `null` se ainda não há. */
  fetchRecording(providerBotId: string): Promise<BotRecordingMedia | null>;
}

/** Custo estimado do bot em centavos — mostrado ANTES de ativar (SPEC 22). */
export function estimarCustoBotCents(minutos: number, centsPorHora: number): number {
  if (minutos <= 0 || centsPorHora <= 0) return 0;
  return Math.round((minutos / 60) * centsPorHora);
}

/** Custo real pelo tempo em chamada (arredonda para cima ao minuto; mínimo 1 min). */
export function custoRealBotCents(
  startedAt: string | null,
  completedAt: string | null,
  centsPorHora: number,
): number | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutos = Math.max(1, Math.ceil(ms / 60_000));
  return estimarCustoBotCents(minutos, centsPorHora);
}

/** Detecta a plataforma pela URL (https + hostname exato/sufixo, sem bypass por substring). */
export function plataformaPorUrl(url: string): BotPlatform | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const h = u.hostname.toLowerCase();
  if (h === 'meet.google.com') return 'meet';
  if (h === 'teams.microsoft.com' || h === 'teams.live.com' || h.endsWith('.teams.microsoft.com'))
    return 'teams';
  if (h === 'zoom.us' || h.endsWith('.zoom.us')) return 'zoom';
  return null;
}

/**
 * Evento de webhook do Recall → status do bot no Talkin. `null` = evento que não
 * muda status (salas simultâneas, permissão de gravação etc.). Códigos novos
 * podem surgir; desconhecidos são ignorados.
 */
export function statusPorEventoRecall(evento: string): BotStatus | null {
  switch (evento) {
    case 'bot.joining_call':
    case 'bot.in_waiting_room':
    case 'bot.in_call_not_recording':
      return 'entrando';
    case 'bot.in_call_recording':
      return 'gravando';
    case 'bot.call_ended':
    case 'bot.done':
      return 'saiu';
    case 'bot.fatal':
      return 'erro';
    default:
      return null;
  }
}

/** Só https e só hosts do Recall/S3 — nunca baixar de um host arbitrário. */
export function urlDeMidiaPermitida(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  return (
    h === 'recall.ai' ||
    h.endsWith('.recall.ai') ||
    h.endsWith('.amazonaws.com') ||
    h.endsWith('.cloudfront.net')
  );
}

/**
 * Extrai a mídia do JSON do bot (GET /api/v1/bot/{id}/). Prefere o áudio
 * misturado (mp3, pede-se `recording_config.audio_mixed_mp3`); cai para o
 * vídeo misturado (mp4) se só ele existir. Tolerante a variações do payload.
 */
export function extrairMidiaRecall(bot: unknown): BotRecordingMedia | null {
  const b = (bot ?? {}) as Record<string, unknown>;
  const recs = Array.isArray(b.recordings) ? (b.recordings as Record<string, unknown>[]) : [];
  for (const r of recs) {
    const atalhos = (r.media_shortcuts ?? {}) as Record<string, unknown>;
    const url = (k: string): string | null => {
      const a = atalhos[k] as Record<string, unknown> | undefined;
      const d = a?.data as Record<string, unknown> | undefined;
      const u = d?.download_url;
      return typeof u === 'string' && urlDeMidiaPermitida(u) ? u : null;
    };
    const audio = url('audio_mixed');
    const video = audio ? null : url('video_mixed');
    const escolhida = audio ?? video;
    if (!escolhida) continue;
    const texto = (v: unknown) => (typeof v === 'string' ? v : null);
    return {
      downloadUrl: escolhida,
      formato: audio ? 'mp3' : 'mp4',
      startedAt: texto(r.started_at),
      completedAt: texto(r.completed_at),
    };
  }
  // Formato antigo: video_url direto no bot.
  const legado = typeof b.video_url === 'string' ? b.video_url : null;
  if (legado && urlDeMidiaPermitida(legado)) {
    return { downloadUrl: legado, formato: 'mp4', startedAt: null, completedAt: null };
  }
  return null;
}

/** Tolerância padrão do carimbo de tempo do webhook (replay). */
export const SVIX_TOLERANCIA_S = 5 * 60;

function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesParaBase64(bytes: ArrayBuffer): string {
  let s = '';
  for (const c of new Uint8Array(bytes)) s += String.fromCharCode(c);
  return btoa(s);
}

function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifica a assinatura de um webhook entregue pelo Svix (Recall usa Svix):
 * HMAC-SHA256(base64(secret sem `whsec_`), `${id}.${timestamp}.${corpo}`) em
 * base64, comparado com cada `v1,<assinatura>` do cabeçalho; carimbo dentro da
 * tolerância. WebCrypto: roda em Node e no edge. Nunca aceitar sem assinatura.
 */
export async function verificarAssinaturaSvix(p: {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  corpo: string;
  secret: string;
  agoraS?: number;
  toleranciaS?: number;
}): Promise<boolean> {
  if (!p.id || !p.timestamp || !p.signature || !p.secret) return false;
  const ts = Number(p.timestamp);
  if (!Number.isFinite(ts)) return false;
  const agora = p.agoraS ?? Math.floor(Date.now() / 1000);
  if (Math.abs(agora - ts) > (p.toleranciaS ?? SVIX_TOLERANCIA_S)) return false;

  const secreto = p.secret.startsWith('whsec_') ? p.secret.slice(6) : p.secret;
  let chave: Uint8Array;
  try {
    chave = base64ParaBytes(secreto);
  } catch {
    return false;
  }
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return false;
  const k = await subtle.importKey(
    'raw',
    new Uint8Array(chave),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const conteudo = new TextEncoder().encode(`${p.id}.${p.timestamp}.${p.corpo}`);
  const esperada = bytesParaBase64(await subtle.sign('HMAC', k, conteudo));

  for (const parte of p.signature.split(' ')) {
    const [versao, valor] = parte.split(',', 2);
    if (versao === 'v1' && valor && iguaisEmTempoConstante(valor, esperada)) return true;
  }
  return false;
}
