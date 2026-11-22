'use client';


import PageSkeleton from '@/components/ui/PageSkeleton';
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

type Finding = {
  rule_id: string;
  title: string;
  severity: string;
  line: number;
  explanation: string;
  suggestion?: string;
  confidence_score?: number;
  confidence_level?: 'high' | 'medium' | 'needs_review' | string;
  confidence_basis?: string;
  verification_status?: string;
  evidence_source?: string;
};

type HistoryItem = {
  id: string;
  filename: string;
  language: string;
  quality_score: number;
  issue_count: number;
  created_at: string | null;
};

type AnalysisResult = {
  id: string;
  filename: string;
  language: string;
  quality_score: number;
  issue_count: number;
  findings: Finding[];
  analysis_scope: string;
  analysis_tools?: string[];
  confidence_summary?: { high: number; medium: number; needs_review: number };
  ai_review: {
    status: string;
    summary: string;
    suggestions: Array<{ file?: string; comment?: string; [key: string]: unknown }>;
    model_used?: string;
    category?: string;
    parallel_calls?: number;
    verification_policy?: string;
  };
};

const starterCode: { python: string; java: string } = {
  python: 'a = 10\nb = 0\nc = a / b\nprint(c)\n',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello PandaHub");\n    }\n}\n',
};

export default function CodeAnalysisPage() {
  const [language, setLanguage] = useState<'python' | 'java'>('python');
  const [filename, setFilename] = useState('main.py');
  const [source, setSource] = useState(starterCode.python);
  const [includeAi, setIncludeAi] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [feedbackStatus, setFeedbackStatus] = useState<Record<string, string>>({});

  const loadHistory = useCallback(async () => {
    try {
      const response = await api.get<HistoryItem[]>('/code-analysis/history');
      setHistory(response.data);
    } catch {
      // Keep the analysis editor usable if history is temporarily unavailable.
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const changeLanguage = (next: 'python' | 'java') => {
    setLanguage(next);
    setFilename(next === 'python' ? 'main.py' : 'Main.java');
    setSource(starterCode[next]);
    setResult(null);
  };

  const analyze = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await api.post<AnalysisResult>('/code-analysis/analyze', {
        source_code: source,
        language,
        filename,
        include_ai_review: includeAi,
      });
      setResult(response.data);
      await loadHistory();
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? String((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Analysis failed.')
        : 'Could not connect to the PandaHub analysis service.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (findingIndex: number, verdict: 'correct' | 'false_positive' | 'partially_correct') => {
    if (!result) return;
    const key = String(findingIndex);
    setFeedbackStatus((current) => ({ ...current, [key]: 'Saving feedback…' }));
    try {
      await api.post(`/code-analysis/${result.id}/feedback`, { finding_index: findingIndex, verdict });
      setFeedbackStatus((current) => ({ ...current, [key]: 'Feedback saved. Thank you.' }));
    } catch (err: unknown) {
      const detail = err && typeof err === 'object' && 'response' in err
        ? String((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Could not save feedback.')
        : 'Could not connect while saving feedback.';
      setFeedbackStatus((current) => ({ ...current, [key]: detail }));
    }
  };

  const downloadJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `pandahub-${result.filename.replace(/[^a-z0-9._-]/gi, '_')}-report.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const severityClass = (severity: string) => {
    if (severity === 'error' || severity === 'high') return 'border-red-500/30 bg-red-500/10 text-red-700';
    if (severity === 'medium') return 'border-amber-500/30 bg-amber-500/10 text-amber-800';
    return 'border-white/10 bg-[#E8F9FF] text-[#475569]';
  };

  return (
    <main className="min-h-screen bg-[#FBFBFB] px-4 py-8 text-[#1F2937] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#64748B]">PandaHub AI</p>
          <h1 className="text-3xl font-semibold tracking-tight">Code Analysis</h1>
          <p className="max-w-2xl text-sm text-[#475569]">Analyze Python and Java source code, inspect findings by line, and request an AI-assisted review using PandaHub's existing review pipeline.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
          <section className="rounded-2xl border border-[#C4D9FF] bg-[#C4D9FF] p-5 shadow-xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {(['python', 'java'] as const).map((item) => (
                  <button key={item} onClick={() => changeLanguage(item)} className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${language === item ? 'bg-[#C5BAFF] text-[#26213F] shadow-sm' : 'border border-[#C4D9FF] bg-[#E8F9FF] text-[#475569] hover:bg-[#C4D9FF]'}`}>{item}</button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-[#475569]"><input type="checkbox" checked={includeAi} onChange={(event) => setIncludeAi(event.target.checked)} /> Include AI review</label>
            </div>
            <input value={filename} onChange={(event) => setFilename(event.target.value)} aria-label="Filename" className="mb-3 w-full rounded-lg border border-[#C4D9FF] bg-[#E8F9FF] px-3 py-2 text-sm outline-none focus:border-white/30" />
            <textarea value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} aria-label="Source code" className="min-h-[360px] w-full resize-y rounded-xl border border-[#C4D9FF] bg-[#E8F9FF] p-4 font-mono text-sm leading-6 text-[#1F2937] outline-none focus:border-white/30" />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#64748B]">Maximum 100,000 characters · Your report is private to your account</span>
              <button type="button" onClick={() => { void analyze(); }} disabled={loading || !source.trim() || !filename.trim()} aria-busy={loading} className="rounded-xl bg-[#C5BAFF] px-5 py-2.5 text-sm font-semibold text-[#342B60] transition hover:bg-[#B8ABF5] disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Analyzing…' : 'Analyze code'}</button>
            </div>
            {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">{error}</p>}
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-[#C4D9FF] bg-[#C4D9FF] p-5">
              <h2 className="text-sm font-semibold">Recent analyses</h2>
              <div className="mt-4 space-y-3">
                {history.length === 0 ? <p className="text-sm text-[#64748B]">Your analysis history will appear here.</p> : history.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-0">
                    <div className="min-w-0"><p className="truncate text-sm text-[#1F2937]">{item.filename}</p><p className="text-xs text-[#64748B]">{item.language.toUpperCase()} · {item.issue_count} findings</p></div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{item.quality_score}/100</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-2xl border border-[#C4D9FF] bg-[#C4D9FF] p-5">
              <h2 className="text-sm font-semibold">Analysis coverage</h2>
              <ul className="mt-3 space-y-2 text-sm text-[#475569]"><li>Python AST, with Ruff and Bandit when installed</li><li>Java lexical checks, with javac when available</li><li>Common risky coding patterns</li><li>AI review through the existing PandaHub router</li></ul>
            </section>
          </aside>
        </div>

        {/* PANDAHUB_AI_RESULT_SHIMMER */}
        {loading && <PageSkeleton variant="detail" label="Analyzing source code" />}
        {result && <section className="space-y-5 rounded-2xl border border-[#C4D9FF] bg-[#C4D9FF] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs uppercase tracking-wider text-[#64748B]">Analysis report</p><h2 className="mt-1 text-xl font-semibold">{result.filename}</h2><p className="mt-1 text-sm text-[#64748B]">{result.issue_count} finding(s) · {result.language.toUpperCase()}</p></div>
            <button onClick={downloadJson} className="rounded-lg border border-[#C4D9FF] px-3 py-2 text-sm text-[#1F2937] hover:bg-[#E8F9FF]">Export JSON</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#E8F9FF] p-4"><p className="text-xs text-[#64748B]">Static quality score (heuristic)</p><p className="mt-1 text-3xl font-semibold">{result.quality_score}<span className="text-base text-[#64748B]">/100</span></p></div>
            <div className="rounded-xl bg-[#E8F9FF] p-4"><p className="text-xs text-[#64748B]">Total findings</p><p className="mt-1 text-3xl font-semibold">{result.issue_count}</p></div>
            <div className="rounded-xl bg-[#E8F9FF] p-4"><p className="text-xs text-[#64748B]">AI review</p><p className="mt-2 text-sm font-semibold capitalize">{result.ai_review.status.replace('_', ' ')}</p></div>
          </div>
          <div><h3 className="mb-3 text-sm font-semibold">Detected issues</h3>{result.findings.length === 0 ? <p className="rounded-xl border border-[#C4D9FF] p-4 text-sm text-[#475569]">No issues were detected by the enabled checks.</p> : <div className="space-y-3">{result.findings.map((finding, index) => <article key={`${finding.rule_id}-${index}`} className="rounded-xl border border-[#C4D9FF] bg-[#E8F9FF] p-4"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{finding.title}</span><span className={`rounded-md border px-2 py-0.5 text-[11px] uppercase ${severityClass(finding.severity)}`}>{finding.severity}</span><span className="ml-auto text-xs text-[#64748B]">Line {finding.line}</span></div><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#475569]"><span className="rounded-md border border-[#C4D9FF] px-2 py-1">Confidence triage: {finding.confidence_score ?? '—'}%</span><span className="rounded-md border border-[#C4D9FF] px-2 py-1">{(finding.confidence_level || 'needs_review').replace('_', ' ')}</span><span>{finding.evidence_source || 'static analysis'}</span></div><p className="mt-2 text-sm text-[#475569]">{finding.explanation}</p>{finding.suggestion && <p className="mt-2 text-sm text-[#64748B]">Suggestion: {finding.suggestion}</p>}{finding.confidence_basis && <p className="mt-2 text-xs text-[#64748B]">Evidence: {finding.confidence_basis}</p>}<div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#C4D9FF] pt-3"><span className="mr-1 text-xs text-[#64748B]">Was this finding correct?</span><button type="button" onClick={() => { void submitFeedback(index, 'correct'); }} className="rounded-md border border-[#C4D9FF] px-2.5 py-1.5 text-xs text-[#475569] hover:bg-[#C4D9FF]">Correct</button><button type="button" onClick={() => { void submitFeedback(index, 'false_positive'); }} className="rounded-md border border-[#C4D9FF] px-2.5 py-1.5 text-xs text-[#475569] hover:bg-[#C4D9FF]">False positive</button><button type="button" onClick={() => { void submitFeedback(index, 'partially_correct'); }} className="rounded-md border border-[#C4D9FF] px-2.5 py-1.5 text-xs text-[#475569] hover:bg-[#C4D9FF]">Partially correct</button>{feedbackStatus[String(index)] && <span role="status" className="text-xs text-[#475569]">{feedbackStatus[String(index)]}</span>}</div></article>)}</div>}</div>
          <div><h3 className="mb-2 text-sm font-semibold">AI review explanation</h3>{result.ai_review.model_used && <p className="mb-2 text-xs text-[#64748B]">Router model: {result.ai_review.model_used}{result.ai_review.category ? ` · Category: ${result.ai_review.category}` : ''}{result.ai_review.parallel_calls ? ` · Parallel review calls: ${result.ai_review.parallel_calls}` : ''}</p>}<div className="whitespace-pre-wrap rounded-xl border border-[#C4D9FF] bg-[#E8F9FF] p-4 text-sm leading-6 text-[#475569]">{result.ai_review.summary || 'No AI explanation returned.'}</div>{result.ai_review.suggestions?.length > 0 && <ul className="mt-3 space-y-2">{result.ai_review.suggestions.map((item, index) => <li key={index} className="rounded-lg border border-white/5 p-3 text-sm text-[#475569]">{item.comment || JSON.stringify(item)}</li>)}</ul>}{result.ai_review.verification_policy && <p className="mt-2 text-xs text-[#64748B]">{result.ai_review.verification_policy}</p>}</div>
          <p className="text-xs text-[#64748B]">Tools: {result.analysis_tools?.join(', ') || 'configured analyzers'}. Scope: {result.analysis_scope}</p>
        </section>}
      </div>
    </main>
  );
}
