// Server component layout — safe for Next.js App Router route groups
import DashboardNav from './DashboardNav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <DashboardNav />
      <main style={{ flex: 1 }}>
        {children}
      </main>
    </div>
  );
}
