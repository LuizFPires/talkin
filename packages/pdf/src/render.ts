import type { AtaDoc } from './types';
import { buildAtaHtml } from './html';

/**
 * Renderiza a ata em PDF A4 via Chromium (Playwright). NÃO roda no CI — precisa
 * do navegador instalado. Em produção, roda no worker/servidor.
 */
export async function renderAtaPdf(doc: AtaDoc): Promise<Uint8Array> {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(buildAtaHtml(doc), { waitUntil: 'networkidle' });
    return await page.pdf({ format: 'A4', printBackground: true });
  } finally {
    await browser.close();
  }
}
