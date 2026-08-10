import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { NavBar } from '@/components/ui/NavBar';
import { PUBLIC_LEDGER_NOTICE } from '@/constants/copy';
import { PUBLIC_ENV } from '@/constants/env';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

const DESCRIPTION = 'A loan position that defends itself. The agent acts, the contract decides.';

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_ENV.NEXT_PUBLIC_SITE_URL),
  title: { default: 'Defral', template: '%s · Defral' },
  description: DESCRIPTION,
  openGraph: { title: 'Defral', description: DESCRIPTION, type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Defral', description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NavBar />
        <main className="mx-auto w-full max-w-5xl px-6 py-14">{children}</main>
        <footer className="mx-auto w-full max-w-5xl border-t border-line-soft px-6 py-8 text-xs text-ink-muted">
          {PUBLIC_LEDGER_NOTICE}
        </footer>
      </body>
    </html>
  );
}
