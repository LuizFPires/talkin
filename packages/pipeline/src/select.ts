import type { Providers } from './ports';
import { DeepgramProvider } from './providers/deepgram';
import { AnthropicAtaProvider } from './providers/anthropic';
import { MockAtaProvider, MockTranscriptionProvider } from './providers/mock';

type Env = {
  DEEPGRAM_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
};

/**
 * Escolhe os provedores pela env. Sem chave, cai no mock determinístico —
 * assim o pipeline roda fim a fim no modo só-código.
 */
export function selectProviders(env: Env = process.env as Env): Providers {
  return {
    transcription: env.DEEPGRAM_API_KEY
      ? new DeepgramProvider(env.DEEPGRAM_API_KEY)
      : new MockTranscriptionProvider(),
    ata: env.ANTHROPIC_API_KEY
      ? new AnthropicAtaProvider(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL)
      : new MockAtaProvider(),
  };
}
