'use client';

import { InlineSkeleton } from '@/components/ui/PageSkeleton';

/** Kept as a compatibility adapter for existing pages and Button loading props.
 * All historical orbit/spinner loaders now display lightweight shimmer shapes. */
export interface PandaLoaderProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  label?: string;
  glow?: boolean;
}

export default function PandaLoader({ size = 'md', className = '', label }: PandaLoaderProps) {
  return <div className={`ph-sk-status ${size === 'xs' || size === 'sm' ? 'ph-sk-status-compact' : ''} ${className}`}>
    <InlineSkeleton label={label || 'Loading content'} compact={size === 'xs' || size === 'sm'} />
  </div>;
}
