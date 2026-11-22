'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Rocket } from 'lucide-react';
import api from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import PageSkeleton from '@/components/ui/PageSkeleton';

type Stage = 'idea' | 'mvp' | 'early_traction' | 'growth' | 'scaling';
type Startup = { slug: string };

const stages: { value: Stage; label: string }[] = [
  { value: 'idea', label: 'Idea' }, { value: 'mvp', label: 'MVP' },
  { value: 'early_traction', label: 'Early traction' },
  { value: 'growth', label: 'Growth' }, { value: 'scaling', label: 'Scaling' },
];

function toSlug(input: string): string {
  return input.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

export default function NewStartupPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [stage, setStage] = useState<Stage>('idea');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setAuthenticated(Boolean(getAccessToken())); }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const cleanName = name.trim();
    const cleanSlug = toSlug(slug);
    if (!cleanName || !cleanSlug) { setError('Enter a name and a valid URL slug.'); return; }
    let websiteUrl: string | null = null;
    if (website.trim()) {
      try {
        const parsed = new URL(website.trim());
        if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('protocol');
        websiteUrl = parsed.toString();
      } catch { setError('Website must be a valid http:// or https:// URL.'); return; }
    }
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post<Startup>('/startups', {
        name: cleanName, slug: cleanSlug, tagline: tagline.trim() || null,
        description: description.trim() || null, website_url: websiteUrl, stage,
      });
      router.push(`/startups/${encodeURIComponent(data.slug)}`);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 409 || status === 400
        ? 'This startup slug may already be taken. Please try another.'
        : status === 401 || status === 403
          ? 'Your account needs permission or verification to publish a startup.'
          : 'Could not create the startup. Check your connection and try again.');
    } finally { setSaving(false); }
  };

  if (authenticated === null) return <PageSkeleton variant="form" label="Preparing startup form" />;
  if (!authenticated) return <main className="ph-startup-detail ph-startup-detail-center"><div className="ph-startup-detail-card">
    <h1>Sign in to list your startup</h1>
    <p>You'll need a PandaHub account to publish a startup profile.</p>
    <div className="ph-startup-detail-actions">
      <Link href="/startups" className="ph-startup-link"><ArrowLeft size={16} /> Back</Link>
      <Link href="/login" className="ph-startup-button">Sign in <ArrowRight size={16} /></Link>
    </div>
  </div></main>;

  return <main className="ph-startup-detail ph-startup-detail-form">
    <div className="ph-startup-detail-inner">
      <Link href="/startups" className="ph-startup-back"><ArrowLeft size={16} /> Startup hub</Link>
      <div className="ph-startup-form-heading"><Rocket size={28} aria-hidden="true" /><h1>List your startup</h1><p>Tell the PandaHub community what you're building.</p></div>
      <form className="ph-startup-form" onSubmit={submit}>
        <label>Startup name <span aria-hidden="true">*</span>
          <input required maxLength={255} value={name} onChange={(e) => {
            const value = e.target.value; setName(value); if (!slugEdited) setSlug(toSlug(value));
          }} placeholder="Your startup name" />
        </label>
        <label>URL slug <span aria-hidden="true">*</span>
          <input required maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(e) => { setSlug(toSlug(e.target.value)); setSlugEdited(true); }} placeholder="your-startup" />
          <small>Your public listing will be at /startups/{slug || 'your-startup'}</small>
        </label>
        <label>Tagline
          <input maxLength={500} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="A short explanation of your idea" />
        </label>
        <label>Stage
          <select value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
            {stages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label>Website (optional)
          <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" />
        </label>
        <label>About your startup
          <textarea rows={6} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What problem are you solving?" />
        </label>
        {error && <p className="ph-startup-form-error" role="alert">{error}</p>}
        <div className="ph-startup-detail-actions">
          <Link href="/startups" className="ph-startup-link">Cancel</Link>
          <button type="submit" disabled={saving} className="ph-startup-button" aria-busy={saving}>{saving ? 'Publishing…' : 'Publish startup'} <ArrowRight size={16} /></button>
        </div>
      </form>
    </div>
  </main>;
}
