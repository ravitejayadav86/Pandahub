import React from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Sun, Moon } from 'lucide-react';

export default function DashboardHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const [dark, setDark] = React.useState<boolean>(false);

  React.useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setDark(isDark);
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (dark) {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
    setDark(!dark);
  };

  return (
    <header className="flex items-center justify-between p-4 bg-glass-header border-b border-glass-border">
      <Button variant="ghost" onClick={onMenuClick} className="md:hidden">
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={3} y1={12} x2={21} y2={12} /><line x1={3} y1={6} x2={21} y2={6} /><line x1={3} y1={18} x2={21} y2={18} /></svg>
      </Button>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={toggleTheme} aria-label="Toggle theme">
          {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
        {user ? (
          <Avatar size="sm" fallback={user.username?.charAt(0) ?? '?'} />
        ) : (
          <Button variant="primary" onClick={() => router.push('/login')}>Sign in</Button>
        )}
        {user && (
          <Button variant="ghost" onClick={() => { clearAuth(); router.push('/'); }}>Sign out</Button>
        )}
      </div>
    </header>
  );
}
