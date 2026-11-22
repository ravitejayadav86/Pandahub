import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sign in to PandaHub',
  description: 'Sign in to your PandaHub workspace',
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ph-auth-layout">
      <header className="ph-auth-topbar">
        <div className="ph-auth-topbar-inner">
          <Link href="/" className="ph-auth-brand" aria-label="PandaHub home">
            <span className="ph-auth-brand-mark" aria-hidden="true">🐼</span>
            <span>Panda<span>Hub</span></span>
          </Link>
          <Link href="/" className="ph-auth-home-link">Back to home <span aria-hidden="true">↗</span></Link>
        </div>
      </header>
      <div className="ph-auth-layout-content">{children}</div>
    </div>
  );
}
