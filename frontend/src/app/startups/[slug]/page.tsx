'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, BriefcaseBusiness, CalendarDays, Layers3, RefreshCw, Users } from 'lucide-react';
import api from '@/lib/api';
import PageSkeleton from '@/components/ui/PageSkeleton';

type Startup = {
  id: string;
  name: string;
  slug: string;
  tagline?: string | null;
  description?: string | null;
  website_url?: string | null;
  stage: string;
  created_at?: string | null;
  member_count?: number;
  open_roles_count?: number;
};

const stageLabels: Record<string, string> = {
  idea: 'Idea', mvp: 'MVP', early_traction: 'Early traction',
  growth: 'Growth', scaling: 'Scaling',
};

function websiteLink(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function StartupDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || '';
  const [startup, setStartup] = useState<Startup | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setStatus('loading');
    setStartup(null);
    api.get<Startup>(`/startups/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) { setStartup(data); setStatus('ready'); }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const responseStatus = (error as { response?: { status?: number } })?.response?.status;
        setStatus(responseStatus === 404 ? 'missing' : 'error');
      });
    return () => controller.abort();
  }, [slug, attempt]);

  if (status === 'loading') return <PageSkeleton variant="detail" label="Loading startup profile" />;

  if (!startup || status !== 'ready') {
    return <main className="ph-startup-detail ph-startup-detail-center">
      <div className="ph-startup-detail-card">
        <h1>{status === 'missing' ? 'Startup not found' : 'Could not load this startup'}</h1>
        <p>{status === 'missing' ? 'This listing may have moved or been removed.' : 'Check your connection, then retry.'}</p>
        <div className="ph-startup-detail-actions">
          <Link className="ph-startup-link" href="/startups"><ArrowLeft size={16} /> All startups</Link>
          {status === 'error' && <button className="ph-startup-button" onClick={retry}><RefreshCw size={16} /> Try again</button>}
        </div>
      </div>
    </main>;
  }

  const website = websiteLink(startup.website_url);
  const createdAt = startup.created_at && !Number.isNaN(Date.parse(startup.created_at))
    ? new Date(startup.created_at).toLocaleDateString()
    : null;

  return <main className="ph-startup-detail">
    <div className="ph-startup-detail-inner">
      <Link href="/startups" className="ph-startup-back"><ArrowLeft size={16} /> Startup hub</Link>
      <section className="ph-startup-detail-hero">
        <div className="ph-startup-logo" aria-hidden="true">{startup.name.slice(0, 1).toUpperCase()}</div>
        <div className="ph-startup-detail-identity">
          <span className="ph-startup-eyebrow">Community startup · {stageLabels[startup.stage] || startup.stage}</span>
          <h1>{startup.name}</h1>
          <p>{startup.tagline || 'Building something new with the PandaHub community.'}</p>
        </div>
        {website && <a href={website} target="_blank" rel="noopener noreferrer" className="ph-startup-button">Visit website <ArrowUpRight size={16} /></a>}
      </section>
      <div className="ph-startup-detail-columns">
        <section className="ph-startup-detail-card">
          <h2>About {startup.name}</h2>
          <p className="ph-startup-description">{startup.description || 'This startup has not added a detailed description yet.'}</p>
        </section>
        <aside className="ph-startup-detail-card ph-startup-detail-info" aria-label="Startup overview">
          <h2>Overview</h2>
          <p><Layers3 size={17} /> <span>Stage</span> <strong>{stageLabels[startup.stage] || startup.stage}</strong></p>
          <p><Users size={17} /> <span>Members</span> <strong>{startup.member_count ?? 0}</strong></p>
          <p><BriefcaseBusiness size={17} /> <span>Open roles</span> <strong>{startup.open_roles_count ?? 0}</strong></p>
          {createdAt && <p><CalendarDays size={17} /> <span>Listed</span> <strong>{createdAt}</strong></p>}
        </aside>
      </div>
    </div>
  </main>;
}
