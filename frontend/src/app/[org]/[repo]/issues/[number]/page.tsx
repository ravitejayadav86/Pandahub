'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CircleDot, MessageSquare, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import PageSkeleton from '@/components/ui/PageSkeleton';

type Issue = {
  id: string; number: number; title: string; description?: string | null;
  state: 'open' | 'closed'; author?: { username: string } | null;
  created_at: string; labels?: { name: string; color: string }[];
  comment_count?: number;
};
type Comment = { id: string; body: string; author?: { username: string } | null; created_at: string };
type CommentList = { items: Comment[]; total: number };

export default function IssueDetailsPage() {
  const params = useParams<{ org: string; repo: string; number: string }>();
  const owner = params.org;
  const repo = params.repo;
  const number = params.number;
  const [issue, setIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const [retryKey, setRetryKey] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [signedIn, setSignedIn] = useState(false);

  const base = `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`;
  useEffect(() => { setSignedIn(Boolean(getAccessToken())); }, []);

  useEffect(() => {
    if (!owner || !repo || !number) return;
    const controller = new AbortController();
    setStatus('loading');
    setIssue(null);
    const issuePath = `${base}/${encodeURIComponent(number)}`;
    Promise.all([
      api.get<Issue>(issuePath, { signal: controller.signal }),
      api.get<CommentList>(`${issuePath}/comments`, { signal: controller.signal }),
    ]).then(([issueResponse, commentResponse]) => {
      if (controller.signal.aborted) return;
      setIssue(issueResponse.data);
      setComments(Array.isArray(commentResponse.data?.items) ? commentResponse.data.items : []);
      setStatus('ready');
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const responseStatus = (error as { response?: { status?: number } })?.response?.status;
      setStatus(responseStatus === 404 ? 'missing' : 'error');
    });
    return () => controller.abort();
  }, [owner, repo, number, base, retryKey]);

  const postComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commentText.trim() || posting) return;
    setPosting(true);
    setPostError('');
    try {
      const { data } = await api.post<Comment>(`${base}/${encodeURIComponent(number)}/comments`, { body: commentText.trim() });
      setComments((old) => [...old, data]);
      setCommentText('');
    } catch {
      setPostError('Comment could not be posted. Please try again.');
    } finally { setPosting(false); }
  };

  if (status === 'loading') return <PageSkeleton variant="detail" label="Loading issue" />;
  return <main className="ph-issue-detail">
    <div className="ph-issue-detail-inner">
      <Link href={base} className="ph-startup-back"><ArrowLeft size={16} /> Issues</Link>
      {status !== 'ready' || !issue ? <section className="ph-startup-detail-card">
        <h1>{status === 'missing' ? 'Issue not found' : 'Could not load issue'}</h1>
        <p>{status === 'missing' ? 'This issue may have been removed.' : 'Please check your connection.'}</p>
        {status === 'error' && <button className="ph-startup-button" onClick={() => setRetryKey((value) => value + 1)}><RefreshCw size={16} /> Retry</button>}
      </section> : <>
        <div className="ph-issue-heading"><span className="ph-issue-number">#{issue.number}</span><h1>{issue.title}</h1>
          <div className="ph-issue-meta"><span className={issue.state === 'open' ? 'ph-issue-state-open' : 'ph-issue-state-closed'}><CircleDot size={14} /> {issue.state}</span>
            <span>{issue.author?.username || 'A PandaHub contributor'}</span>
            <span>opened {new Date(issue.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="ph-issue-layout">
          <div className="ph-issue-main">
            <section className="ph-startup-detail-card"><h2>Description</h2><p className="ph-startup-description">{issue.description || 'No description provided.'}</p></section>
            <section className="ph-startup-detail-card"><h2 className="ph-issue-comments-title"><MessageSquare size={18} /> Discussion ({comments.length})</h2>
              {comments.length ? comments.map((comment) => <article className="ph-issue-comment" key={comment.id}>
                <header><strong>{comment.author?.username || 'Contributor'}</strong> <time>{new Date(comment.created_at).toLocaleDateString()}</time></header>
                <p className="ph-startup-description">{comment.body}</p>
              </article>) : <p className="ph-issue-empty">No comments yet.</p>}
              {signedIn ? <form onSubmit={postComment} className="ph-issue-comment-form"><label htmlFor="ph-comment-body">Add a comment</label>
                <textarea id="ph-comment-body" rows={4} maxLength={20000} required value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Write a helpful comment…" />
                {postError && <p role="alert" className="ph-inline-error">{postError}</p>}
                <button type="submit" disabled={posting || !commentText.trim()} className="ph-startup-button">{posting ? 'Posting…' : 'Post comment'}</button>
              </form> : <p className="ph-issue-empty"><Link href="/login">Sign in</Link> to join the discussion.</p>}
            </section>
          </div>
          <aside className="ph-startup-detail-card ph-issue-sidebar"><h2>Labels</h2>
            {issue.labels?.length ? issue.labels.map((label) => <span key={label.name} className="ph-issue-label">{label.name}</span>) : <p>No labels</p>}
          </aside>
        </div>
      </>}
    </div>
  </main>;
}
