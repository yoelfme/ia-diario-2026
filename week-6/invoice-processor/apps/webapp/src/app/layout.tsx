import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '../components/query-provider';

export const metadata: Metadata = {
  title: 'Invoice Processor',
  description: 'Digitalización y revisión manual de facturas',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}

