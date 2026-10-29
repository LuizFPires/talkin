import type { AtaDoc } from './types';
import { buildAtaHtml } from './html';

/**
 * Renderiza a ata em PDF A4 via Chromium (Playwright). NÃO roda no CI — precisa
 * do navegador instalado. Em produção, roda no worker/servidor.
 */
export async function renderAtaPdf(doc: AtaDoc): Promise<Uint8Array> {
  // webpackIgnore evita que o bundler do Next rastreie o playwright-core
  // (só existe/roda no servidor com Chromium instalado).
  const { chromium } = await import(/* webpackIgnore: true */ 'playwright-core');
  const browser = await chromium.launch();
  try {
    // Sem JS: a ata é HTML estático; nada de script deve rodar no render.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    // Bloqueia toda rede exceto as fontes (anti-SSRF). A logo deve vir como data: URI.
    const permitidos = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
    await page.route('**', (route) => {
      const url = route.request().url();
      if (url.startsWith('data:') || permitidos.has(new URL(url).hostname)) {
        void route.continue();
      } else {
        void route.abort();
      }
    });
    await page.setContent(buildAtaHtml(doc), { waitUntil: 'networkidle' });
    return await page.pdf({ format: 'A4', printBackground: true });
  } finally {
    await browser.close();
  }
}
