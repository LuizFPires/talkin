import type { NextConfig } from 'next';

const config: NextConfig = {
  // Lint roda via `pnpm lint` (turbo); o build não repete.
  eslint: { ignoreDuringBuilds: true },
  // Pacotes do monorepo são TS puro (main → src); o Next transpila.
  transpilePackages: ['@talkin/ui', '@talkin/core'],
};

export default config;
