import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'PandaHub', template: '%s | PandaHub' },
  description: 'Self-hosted Git repository hosting platform. Build. Collaborate. Innovate.',
  keywords: ['git', 'repository', 'code hosting', 'collaboration', 'open source'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
