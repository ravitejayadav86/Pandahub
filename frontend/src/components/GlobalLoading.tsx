'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import PandaLoader from '@/components/ui/PandaLoader';

/**
 * GlobalLoading — Single, unified, ultra-premium route change indicator.
 *
 * Replaces multiple overlapping progress bars, background dimmers, and spinners
 * with a single signature PandaHub photonic orbital animation.
 */
export default function GlobalLoading() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Show single loader on route transition
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [pathname]);

  if (!loading) return null;

  return (
    <div
      aria-label="Loading page..."
      className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center"
    >
      {/* Single floating glass badge containing ONLY the single unified PandaLoader */}
      <div className="motion-blur-scale flex items-center justify-center p-5 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/60 shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
        <PandaLoader size="lg" glow={true} />
      </div>
    </div>
  );
}
