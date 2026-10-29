import type { Providers } from './ports';
import { DeepgramProvider } from './providers/deepgram';
import { AnthropicAtaProvider } from './providers/anthropic';
import { MockAtaProvider, MockTranscriptionProvider } from './providers/mock';
import { MockEmbeddingProvider, OpenAIEmbeddingProvider } from './providers/embedding';

type Env = {
  DEEPGRAM_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  OPENAI_API_KEY?: string;
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
    embedding: env.OPENAI_API_KEY
      ? new OpenAIEmbeddingProvider(env.OPENAI_API_KEY)
      : new MockEmbeddingProvider(),
  };
}
