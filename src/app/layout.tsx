import type { Metadata, Viewport } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './globals.css';
import { SaveProvider } from '../components/save-provider';
import { Shell } from '../components/shell';
export const metadata: Metadata = {
  title: 'F1 Universe 2029 — A nova era',
  description:
    '16 equipes. 32 pilotos. 35 GPs. Um universo fictício de automobilismo para gerenciar e explorar.',
};
export const viewport: Viewport = { themeColor: '#101216', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <SaveProvider>
          <Shell>{children}</Shell>
        </SaveProvider>
      </body>
    </html>
  );
}
