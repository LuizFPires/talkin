import type { Metadata } from 'next';
import { Inter, Sora, JetBrains_Mono } from 'next/font/google';
import '@talkin/ui/tokens.css';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });
const sora = Sora({ subsets: ['latin'], variable: '--font-doc', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Talkin',
  description:
    'Gravador inteligente de reuniões: grava, transcreve, gera atas e permite perguntar.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sora.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
