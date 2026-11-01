import type {
  BotProvider,
  BotRecordingMedia,
  ScheduleBotInput,
  ScheduleBotResult,
} from '@talkin/core';
import { extrairMidiaRecall } from '@talkin/core';

/** Custo por hora do bot (centavos). Público para a UI mostrar o mesmo valor. */
export const BOT_CENTS_PER_HOUR = Number(
  process.env.NEXT_PUBLIC_BOT_CENTS_PER_HOUR ?? process.env.BOT_CENTS_PER_HOUR ?? '150',
);

/** Nome com que o bot entra na reunião (nunca oculto, SPEC 22). */
export const BOT_NOME = 'Talkin — gravador';

/** Aviso enviado no chat ao entrar (Meet limita a 500 caracteres). */
export const BOT_AVISO_CHAT =
  'Esta reunião está sendo gravada pelo Talkin para gerar a ata. Se não concordar, avise agora.';

const REGIOES = new Set(['us-east-1', 'us-west-2', 'eu-central-1', 'ap-northeast-1']);

/** Base da API do Recall na região da conta (cada região tem credenciais próprias). */
export function recallBaseUrl(): string {
  const r = (process.env.RECALL_REGION ?? 'us-east-1').trim();
  return `https://${REGIOES.has(r) ? r : 'us-east-1'}.recall.ai`;
}

export function botConfigurado(): boolean {
  return Boolean(process.env.RECALL_API_KEY);
}

/** Recall.ai: agenda um bot que entra na reunião, avisa no chat e grava o áudio. */
class RecallBotProvider implements BotProvider {
  readonly name = 'recall';
  constructor(
    private readonly apiKey: string,
    private readonly base: string,
  ) {}

  private get headers() {
    return { Authorization: `Token ${this.apiKey}`, 'content-type': 'application/json' };
  }

  async scheduleBot(input: ScheduleBotInput): Promise<ScheduleBotResult> {
    const res = await fetch(`${this.base}/api/v1/bot/`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        meeting_url: input.meetingUrl,
        bot_name: input.displayName ?? BOT_NOME,
        // Só o áudio misturado em mp3: é o que o pipeline transcreve.
        recording_config: { audio_mixed_mp3: {} },
        // Indicador de gravação para os participantes (CLAUDE.md: nunca oculto).
        chat: { on_bot_join: { send_to: 'everyone', message: BOT_AVISO_CHAT } },
        // Sai sozinho quando a reunião esvazia ou ninguém aparece.
        automatic_leave: { everyone_left_timeout: { timeout: 60 }, noone_joined_timeout: 900 },
        metadata: input.referencia ? { talkin_bot_id: input.referencia } : undefined,
      }),
    });
    if (!res.ok) {
      // Sem ecoar o corpo (pode conter detalhes da conta); o status basta para diagnóstico.
      throw new Error(`Recall ${res.status}`);
    }
    const json = (await res.json()) as { id: string };
    return { providerBotId: json.id, status: 'entrando' };
  }

  private validarId(providerBotId: string) {
    // Valida o id antes de montar a URL (anti path injection).
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(providerBotId)) throw new Error('bot id inválido');
  }

  async stopBot(providerBotId: string): Promise<void> {
    this.validarId(providerBotId);
    await fetch(`${this.base}/api/v1/bot/${encodeURIComponent(providerBotId)}/leave_call/`, {
      method: 'POST',
      headers: this.headers,
    });
  }

  async fetchRecording(providerBotId: string): Promise<BotRecordingMedia | null> {
    this.validarId(providerBotId);
    const res = await fetch(`${this.base}/api/v1/bot/${encodeURIComponent(providerBotId)}/`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Recall ${res.status}`);
    return extrairMidiaRecall(await res.json());
  }
}

/** Mock determinístico (testes / `BOT_PROVIDER=mock`): nada entra em reunião nenhuma. */
class MockBotProvider implements BotProvider {
  readonly name = 'mock';
  async scheduleBot(): Promise<ScheduleBotResult> {
    return { providerBotId: `mock-${Date.now()}`, status: 'agendado' };
  }
  async stopBot(): Promise<void> {}
  async fetchRecording(): Promise<BotRecordingMedia | null> {
    return null;
  }
}

/**
 * Provedor real só com `RECALL_API_KEY`. Sem chave, devolve `null` em produção
 * (a rota responde "bot não configurado") — o mock só entra se pedido
 * explicitamente, para nunca fingir que um bot entrou numa reunião.
 */
export function selectBotProvider(): BotProvider | null {
  const key = process.env.RECALL_API_KEY ?? '';
  if (key) return new RecallBotProvider(key, recallBaseUrl());
  if (process.env.BOT_PROVIDER === 'mock') return new MockBotProvider();
  return null;
}
