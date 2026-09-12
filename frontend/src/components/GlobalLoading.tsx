'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * GlobalLoading — App Router compatible route-change indicator.
 *
 * next/router events don't exist in the App Router; instead we watch
 * usePathname() for changes and briefly show the loading overlay.
 */
export default function GlobalLoading() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Flash the loader whenever the route changes
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!loading) return null;

  return (
    <div
      aria-label="Loading"
      className="fixed inset-x-0 top-0 z-[9999] pointer-events-none"
    >
      {/* Thin progress bar at the top — premium feel, zero layout impact */}
      <div className="h-[2.5px] w-full bg-gradient-to-r from-[#0A84FF] via-[#7c3aed] to-[#06b6d4] animate-gradient origin-left" />

      {/* Subtle full-screen dimmer with motion blur */}
      <div className="fixed inset-0 bg-black/5 backdrop-blur-[1px] animate-fade-in-scale" />

      {/* Centered spinner */}
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="relative w-12 h-12">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-[2.5px] border-slate-200/40 dark:border-slate-700/40" />
          {/* Spinning arc */}
          <div className="absolute inset-0 rounded-full border-[2.5px] border-transparent border-t-[#0A84FF] animate-spin-slow" />
          {/* Inner glow dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#0A84FF] animate-glow-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
