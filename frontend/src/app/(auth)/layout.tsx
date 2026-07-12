import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sign in to PandaHub',
  description: 'Sign in to your PandaHub account',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
    }}>
      {/* Top bar */}
      <header style={{
        padding: '20px 24px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center',
        background: 'rgba(13, 17, 23, 0.8)',
        backdropFilter: 'blur(20px)',
      }}>
        <Link href="/" style={{
          display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--gradient-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>🐼</div>
          <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>
            Panda<span style={{
              background: 'var(--gradient-brand)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>Hub</span>
          </span>
        </Link>
      </header>

      {/* Content */}
      <div style={{
        flex: 1, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
        position: 'relative',
      }}>
        {/* Background blobs */}
        <div style={{
          position: 'fixed', top: '20%', left: '10%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'fixed', bottom: '20%', right: '10%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {children}
      </div>
    </div>
  );
}
