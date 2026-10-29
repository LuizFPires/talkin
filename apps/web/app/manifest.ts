import type { MetadataRoute } from 'next';

/** Web manifest do PWA (SPEC — M9). Gera /manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Talkin',
    short_name: 'Talkin',
    description:
      'Gravador inteligente de reuniões: grava, transcreve, gera atas e permite perguntar.',
    lang: 'pt-BR',
    start_url: '/',
    display: 'standalone',
    background_color: '#030707',
    theme_color: '#030707',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
