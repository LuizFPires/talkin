/** Bot de reunião (SPEC 22): entra na reunião, grava e sai. Opcional. */

export type BotPlatform = 'meet' | 'teams' | 'zoom';
export type BotStatus = 'agendado' | 'entrando' | 'gravando' | 'saiu' | 'erro';

export type ScheduleBotInput = {
  meetingUrl: string;
  platform: BotPlatform;
  /** Nome exibido do bot na reunião (nunca oculto). */
  displayName?: string;
};

export type ScheduleBotResult = {
  providerBotId: string;
  status: BotStatus;
};

/** Provedor de bot (Recall.ai, mock). */
export interface BotProvider {
  readonly name: string;
  scheduleBot(input: ScheduleBotInput): Promise<ScheduleBotResult>;
  stopBot(providerBotId: string): Promise<void>;
}

/** Custo estimado do bot em centavos — mostrado ANTES de ativar (SPEC 22). */
export function estimarCustoBotCents(minutos: number, centsPorHora: number): number {
  if (minutos <= 0 || centsPorHora <= 0) return 0;
  return Math.round((minutos / 60) * centsPorHora);
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
