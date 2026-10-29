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

/** Detecta a plataforma pela URL da reunião. */
export function plataformaPorUrl(url: string): BotPlatform | null {
  const u = url.toLowerCase();
  if (u.includes('meet.google.com')) return 'meet';
  if (u.includes('teams.microsoft.com') || u.includes('teams.live.com')) return 'teams';
  if (u.includes('zoom.us')) return 'zoom';
  return null;
}
