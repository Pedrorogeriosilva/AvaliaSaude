import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Avalia Saúde - Porto Alegre do Norte',
  description: 'Sistema municipal de avaliação das unidades de saúde.',
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