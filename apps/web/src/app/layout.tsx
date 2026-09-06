import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'CPPinSync — People & Organization',
  description: 'CPPinSync employee, organization, and leave management.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
