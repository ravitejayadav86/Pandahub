/* PANDAHUB_SHIMMER_UI_V2: route fallback */
import PageSkeleton from '@/components/ui/PageSkeleton';

export default function Loading() {
  return <PageSkeleton variant="dashboard" label="Loading PandaHub workspace" />;
}
