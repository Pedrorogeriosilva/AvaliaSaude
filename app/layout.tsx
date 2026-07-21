import type { Metadata, Viewport } from 'next';
import './globals.css';

// Explícito de propósito: sem `maximumScale` nem `userScalable: false`, para
// que ninguém fique impedido de ampliar a tela para conseguir ler.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Avalia Saúde - Porto Alegre do Norte',
  description: 'Avalia Saúde.',
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: '/brand/favicon.ico',
    shortcut: '/brand/favicon.ico',
    apple: '/brand/logo-avalia-saude-simbolo.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
