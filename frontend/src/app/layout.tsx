import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ErrorBoundary }  from '@/components/shared/ErrorBoundary';
import { ToastProvider }  from '@/components/shared/ToastProvider';

export const metadata: Metadata = {
  title: { default: 'PandaHub', template: '%s | PandaHub' },
  description: 'Self-hosted Git repository hosting platform. Build. Collaborate. Innovate.',
  keywords: ['git', 'repository', 'code hosting', 'collaboration', 'open source'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8F9FB' },
    { media: '(prefers-color-scheme: dark)',  color: '#0f172a' },
  ],
  viewportFit: 'cover', // enables safe-area-inset-* on iOS notch devices
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/*
          ErrorBoundary: catches any render-phase crash in the entire client
          component tree and shows a friendly fallback instead of a blank page.

          ToastProvider: mounts the toast container and provides the useToast()
          context to every component in the tree.
        */}
        <ErrorBoundary>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
