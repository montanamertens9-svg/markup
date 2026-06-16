import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Markup Clone',
  description: 'Comment directly on live URLs',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
