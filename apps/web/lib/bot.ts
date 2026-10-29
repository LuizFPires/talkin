import type { BotProvider, ScheduleBotInput, ScheduleBotResult } from '@talkin/core';

/** Custo por hora do bot (centavos). Ajustar conforme o contrato do Recall. */
export const BOT_CENTS_PER_HOUR = Number(process.env.BOT_CENTS_PER_HOUR ?? '150');

/** Recall.ai: agenda um bot que entra na reunião e grava. */
class RecallBotProvider implements BotProvider {
  readonly name = 'recall';
  constructor(private readonly apiKey: string) {}

  async scheduleBot(input: ScheduleBotInput): Promise<ScheduleBotResult> {
    const res = await fetch('https://api.recall.ai/api/v1/bot/', {
      method: 'POST',
      headers: { Authorization: `Token ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        meeting_url: input.meetingUrl,
        bot_name: input.displayName ?? 'Talkin — gravador',
      }),
    });
    if (!res.ok) throw new Error(`Recall ${res.status}`);
    const json = (await res.json()) as { id: string };
    return { providerBotId: json.id, status: 'entrando' };
  }

  async stopBot(providerBotId: string): Promise<void> {
    await fetch(`https://api.recall.ai/api/v1/bot/${providerBotId}/leave_call/`, {
      method: 'POST',
      headers: { Authorization: `Token ${this.apiKey}` },
    });
  }
}

/** Mock determinístico para o modo só-código (sem chave do Recall). */
class MockBotProvider implements BotProvider {
  readonly name = 'mock';
  async scheduleBot(): Promise<ScheduleBotResult> {
    return { providerBotId: `mock-${Date.now()}`, status: 'agendado' };
  }
  async stopBot(): Promise<void> {}
}

export function selectBotProvider(): BotProvider {
  const key = process.env.RECALL_API_KEY ?? '';
  return key ? new RecallBotProvider(key) : new MockBotProvider();
}
