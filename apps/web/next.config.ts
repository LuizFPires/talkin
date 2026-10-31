import type { NextConfig } from 'next';

// Versão do build, inlined no cliente e no service worker: muda a cada deploy,
// o que faz o navegador detectar a versão nova (sw.js com bytes diferentes).
const VERSAO = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || String(Date.now());

const config: NextConfig = {
  env: { NEXT_PUBLIC_VERSAO: VERSAO },
  // Lint roda via `pnpm lint` (turbo); o build não repete.
  eslint: { ignoreDuringBuilds: true },
  // Pacotes do monorepo são TS puro (main → src); o Next transpila.
  transpilePackages: ['@talkin/ui', '@talkin/core', '@talkin/pipeline', '@talkin/pdf'],
  // playwright-core só roda no servidor (render do PDF); não empacotar no bundle.
  // Navegadores headless só no servidor: fora do bundle (Chromium serverless + drivers).
  serverExternalPackages: ['playwright-core', 'puppeteer-core', '@sparticuz/chromium'],
};

export default config;
