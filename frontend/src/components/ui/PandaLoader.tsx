'use client';

import React from 'react';

export interface PandaLoaderProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  label?: string;
  glow?: boolean;
}

const SIZES = {
  xs: { box: 16, stroke: 2.2, r: 6 },
  sm: { box: 24, stroke: 2.5, r: 9 },
  md: { box: 40, stroke: 3.0, r: 16 },
  lg: { box: 56, stroke: 3.5, r: 23 },
  xl: { box: 72, stroke: 4.0, r: 30 },
};

/**
 * PandaLoader — Single, unified, ultra-premium loading animation.
 *
 * Implements a single photonic orbital comet with velocity-based stroke stretch,
 * soft phosphorescent wake, and precision cubic-bezier acceleration.
 * Zero redundant background dimmers or secondary bars.
 */
export default function PandaLoader({
  size = 'md',
  className = '',
  label,
  glow = true,
}: PandaLoaderProps) {
  const config = SIZES[size] || SIZES.md;
  const { box, stroke, r } = config;
  const center = box / 2;
  const circumference = 2 * Math.PI * r;
  const gradientId = React.useId();

  return (
    <div
      role="status"
      aria-label={label || 'Loading...'}
      className={`inline-flex flex-col items-center justify-center select-none ${className}`}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: box, height: box }}
      >
        {/* Ambient photonic bloom behind the loader */}
        {glow && (
          <div
            className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#0A84FF]/25 via-[#7c3aed]/20 to-[#06b6d4]/25 blur-md pointer-events-none transform-gpu animate-glow-pulse"
            style={{ transform: 'scale(1.2)' }}
          />
        )}

        {/* The single unified SVG orbital animation */}
        <svg
          width={box}
          height={box}
          viewBox={`0 0 ${box} ${box}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 animate-spin-blur"
          style={{ willChange: 'transform, filter' }}
        >
          <defs>
            <linearGradient id={`${gradientId}-orbit`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0A84FF" />
              <stop offset="50%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>

            {/* Subtle background track glow filter */}
            <filter id={`${gradientId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Faint precision guide track */}
          <circle
            cx={center}
            cy={center}
            r={r}
            stroke="currentColor"
            strokeWidth={Math.max(1.2, stroke * 0.45)}
            className="text-slate-300/30 dark:text-slate-700/40"
          />

          {/* Primary velocity comet with dynamic motion-stretched arc */}
          <circle
            cx={center}
            cy={center}
            r={r}
            stroke={`url(#${gradientId}-orbit)`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.65} ${circumference * 0.35}`}
            strokeDashoffset={circumference * 0.15}
            filter={`url(#${gradientId}-glow)`}
            className="origin-center"
          />
        </svg>

        {/* Central photonic micro-dot for depth & focus */}
        {size !== 'xs' && (
          <div
            className="absolute rounded-full bg-gradient-to-r from-[#0A84FF] to-[#7c3aed] shadow-[0_0_8px_rgba(10,132,255,0.6)] animate-pulse"
            style={{
              width: Math.max(3, box * 0.08),
              height: Math.max(3, box * 0.08),
            }}
          />
        )}
      </div>

      {label && (
        <span className="mt-2 text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400 animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
}
