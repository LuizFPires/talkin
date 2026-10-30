import type { Metadata, Viewport } from 'next';
import { Inter, Sora, JetBrains_Mono } from 'next/font/google';
import '@talkin/ui/tokens.css';
import './globals.css';
import { SWRegister } from '@/components/sw-register';

const inter = Inter({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });
const sora = Sora({ subsets: ['latin'], variable: '--font-doc', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Talkin',
  description:
    'Gravador inteligente de reuniões: grava, transcreve, gera atas e permite perguntar.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Talkin', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#030707',
  // Permite usar as safe-areas (notch/barra inferior) no shell mobile.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sora.variable} ${mono.variable}`}>
      <body>
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
