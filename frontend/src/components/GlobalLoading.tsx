import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function GlobalLoading() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleStart = () => setLoading(true);
    const handleComplete = () => setLoading(false);
    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleComplete);
    // Ensure loading is false on initial mount
    setLoading(false);
    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleComplete);
    };
  }, [router]);

  if (!loading) return null;
  return (
    <div className="global-loading fixed inset-0 flex items-center justify-center z-50 bg-white/30 backdrop-blur-sm">
      <div className="spinner w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin-slow" />
    </div>
  );
}
