import PageSkeleton from '@/components/ui/PageSkeleton';

interface LoadingSpinnerProps {
  size?: number;
  label?: string;
}

/** Compatibility adapter for repository lists: keep the same API, use shimmer. */
export default function LoadingSpinner({ label = 'Loading content' }: LoadingSpinnerProps) {
  return <PageSkeleton variant="list" label={label} />;
}
