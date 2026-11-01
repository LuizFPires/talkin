/** Versão embutida neste build (commit curto na Vercel; 'dev' localmente). */
export const VERSAO_LOCAL = process.env.NEXT_PUBLIC_VERSAO ?? 'dev';

/**
 * Versão que o servidor está servindo agora, lida de /sw.js (muda a cada
 * deploy). `null` se não deu para ler (offline, erro).
 */
export async function versaoNoServidor(): Promise<string | null> {
  try {
    const res = await fetch(`/sw.js?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const m = /versão\s+(\S+)/.exec(await res.text());
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}
