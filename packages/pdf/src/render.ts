import type { AtaDoc } from './types';
import { buildAtaHtml } from './html';

/** Domínios que o render pode acessar (fontes). A logo vem como data: URI. */
const PERMITIDOS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

function permitido(url: string): boolean {
  if (url.startsWith('data:')) return true;
  try {
    return PERMITIDOS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Renderiza a ata em PDF A4.
 *
 * Em serverless (Vercel/Lambda) usa o Chromium empacotado do @sparticuz/chromium
 * com puppeteer-core; fora dele (dev/worker com navegador instalado) usa o
 * Playwright local. Sem JS na página e com rede bloqueada fora das fontes
 * (anti-SSRF). NÃO roda no CI: precisa de um navegador. Quem chama trata a
 * falha (a rota /api/pdf devolve a versão HTML imprimível).
 */
export async function renderAtaPdf(doc: AtaDoc): Promise<Uint8Array> {
  const html = buildAtaHtml(doc);
  const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  return serverless ? renderServerless(html) : renderLocal(html);
}

async function renderServerless(html: string): Promise<Uint8Array> {
  // webpackIgnore: pacotes marcados como externos no servidor; não entram no bundle.
  const chromium = (await import(/* webpackIgnore: true */ '@sparticuz/chromium')).default;
  const puppeteer = (await import(/* webpackIgnore: true */ 'puppeteer-core')).default;
  const browser = await puppeteer.launch({
    args: puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
    executablePath: await chromium.executablePath(),
    headless: 'shell',
  });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (permitido(req.url())) void req.continue();
      else void req.abort();
    });
    await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
    // Fontes (Sora) carregam depois do `load`; espera com tolerância.
    try {
      // Sem lib DOM no tsconfig do pacote: avalia como texto.
      await page.evaluate('document.fonts && document.fonts.ready');
    } catch {
      // JS desligado em alguns ambientes: segue com a fonte de fallback.
    }
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}

async function renderLocal(html: string): Promise<Uint8Array> {
  const { chromium } = await import(/* webpackIgnore: true */ 'playwright-core');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.route('**', (route) => {
      if (permitido(route.request().url())) void route.continue();
      else void route.abort();
    });
    await page.setContent(html, { waitUntil: 'networkidle' });
    return await page.pdf({ format: 'A4', printBackground: true });
  } finally {
    await browser.close();
  }
}
