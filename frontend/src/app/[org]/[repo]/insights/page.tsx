"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BrainCircuit, ArrowLeft, RefreshCw, ShieldAlert } from "lucide-react";
import api from "@/lib/api";

type NextStep = {
  action: string;
  file: string;
  priority: string;
  source: string;
  verified: boolean;
};
type Analysis = {
  id: string;
  branch: string;
  sha: string;
  status: "queued" | "running" | "completed" | "failed" | "skipped";
  summary: string | null;
  model_used: string | null;
  next_steps: NextStep[];
  error: string | null;
  created_at: string | null;
};

function message(error: unknown): string {
  const data = error as { response?: { status?: number; data?: { detail?: string } } };
  if (data?.response?.status === 403) return "Only repository administrators can change AI settings.";
  return data?.response?.data?.detail || "Unable to load PandaHub commit insights.";
}

export default function CommitInsightsPage() {
  const params = useParams<{ org: string; repo: string }>();
  const owner = params?.org || "";
  const repo = params?.repo || "";
  const repoUrl = `/${owner}/${repo}`;
  const endpoint = `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/insights`;
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!owner || !repo) return;
    setLoading(true);
    setError(null);
    try {
      const [settingsResult, reviewsResult] = await Promise.all([
        api.get<{ enabled: boolean }>(`${endpoint}/settings`),
        api.get<Analysis[]>(endpoint),
      ]);
      setEnabled(settingsResult.data.enabled);
      setItems(reviewsResult.data);
    } catch (exc) {
      setError(message(exc));
    } finally {
      setLoading(false);
    }
  }, [endpoint, owner, repo]);

  useEffect(() => { void load(); }, [load]);

  const changeEnabled = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await api.patch<{ enabled: boolean }>(`${endpoint}/settings`, {
        enabled: !enabled,
      });
      setEnabled(response.data.enabled);
    } catch (exc) {
      setError(message(exc));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-7 px-5 py-10 sm:px-8">
        <Link href={repoUrl} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-current">
          <ArrowLeft size={16} /> Back to repository
        </Link>
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3"><BrainCircuit size={25} /><h1 className="text-3xl font-semibold tracking-tight">Commit insights</h1></div>
            <p className="max-w-2xl text-sm text-zinc-500">Evidence-based AI feedback about code pushed to {owner}/{repo}. Reviews are advisory; tests and deployment are separate.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
            <RefreshCw size={15} /> Refresh
          </button>
        </header>
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          <div className="space-y-1"><h2 className="font-semibold">Automatic AI review on push</h2>
            <p className="max-w-xl text-xs text-zinc-500">Disabled by default. Enabling this allows pushed code diffs to be sent to your configured external AI provider. Only repository administrators can change it.</p>
          </div>
          <button type="button" onClick={() => void changeEnabled()} disabled={saving || loading}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
            {saving ? "Saving…" : enabled ? "Disable AI analysis" : "Enable AI analysis"}
          </button>
        </section>
        {error && <p role="alert" className="rounded-xl border border-zinc-300 p-4 text-sm dark:border-zinc-700">{error}</p>}
        <section className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Recorded commit reviews</h2><span className="text-xs text-zinc-500">{items.length} records</span></div>
          {loading ? <p className="text-zinc-500">Loading recorded results…</p>
            : items.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-800">No recorded reviews. Enable analysis, then push a new commit with PandaHub CLI.</p>
            : items.map((item) => (
              <article key={item.id} className="space-y-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><code className="text-sm font-semibold">{item.sha.slice(0, 12)}</code><span className="ml-3 text-xs text-zinc-500">{item.branch}</span></div>
                  <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700">{item.status}</span>
                </div>
                {item.model_used && <p className="text-xs text-zinc-500">Model: {item.model_used}</p>}
                {item.summary && <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.summary}</p>}
                {item.error && <p className="text-sm text-zinc-600 dark:text-zinc-400">{item.error}</p>}
                {item.next_steps.length > 0 && <div className="space-y-3"><h3 className="text-sm font-semibold">Suggested next steps</h3>
                  {item.next_steps.map((step, index) => <div key={`${item.id}-${index}`} className="border-l-2 border-zinc-300 pl-3 dark:border-zinc-700">
                    <p className="text-sm">{step.action}</p><p className="mt-1 text-xs text-zinc-500">{step.priority} priority · {step.file || "Repository"} · AI-generated, unverified</p>
                  </div>)}
                </div>}
              </article>
            ))}
        </section>
        <p className="flex items-start gap-2 text-xs text-zinc-500"><ShieldAlert size={16} className="shrink-0" /> AI suggestions cannot confirm build success or deploy readiness. Use actual CI/CD test results before publishing.</p>
      </div>
    </main>
  );
}
