"use client";

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import api from '@/lib/api';

const SpaceBackground = dynamic(() => import('../../SpaceBackground'), { ssr: false });

/* ─── Step 1: Request reset email ─────────────────────────────────────────── */
function RequestResetStep({
  onSent,
}: {
  onSent: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Always returns 204 — no enumeration signal even for unknown emails
      await api.post('/auth/password-reset/request', { email });
      onSent(email);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 sm:p-10">
      <div className="flex flex-col items-center mb-8">
        <div
          className="skeu-icon-badge w-14 h-14 flex items-center justify-center mb-5"
          style={{ background: 'linear-gradient(145deg, #1a9aff 0%, #0055cc 100%)' }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 28, color: 'white', fontVariationSettings: '"FILL" 1' }}
          >
            lock_reset
          </span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-center" style={{ color: 'var(--text-primary)' }}>
          Forgot your password?
        </h1>
        <p className="text-sm text-center mt-2 max-w-xs" style={{ color: 'var(--text-secondary)' }}>
          Enter the email address on your account and we'll send you a reset link.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm text-center flex items-center gap-2 justify-center animate-bounce-in"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
          {error}
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label
            className="block text-xs font-semibold tracking-wide ml-1"
            htmlFor="reset-email"
            style={{ color: 'var(--text-secondary)' }}
          >
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>mail</span>
            </div>
            <input
              id="reset-email"
              type="email"
              required
              className="input-glass block w-full pl-11 pr-4 py-3.5 rounded-xl text-sm"
              style={{ color: 'var(--text-primary)' }}
              placeholder="name@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="skeu-btn-primary btn-ripple w-full flex justify-center items-center gap-2 py-4 rounded-xl font-bold text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sending…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
              Send Reset Link
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <a href="/login" className="text-sm font-semibold transition-colors" style={{ color: 'var(--color-primary)' }}>
          ← Back to sign in
        </a>
      </div>
    </div>
  );
}

/* ─── Step 2: Email sent confirmation ─────────────────────────────────────── */
function EmailSentStep({ email }: { email: string }) {
  return (
    <div className="p-8 sm:p-10 flex flex-col items-center text-center animate-fade-in-scale">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{
          background: 'rgba(34,197,94,0.12)',
          boxShadow: '0 0 32px rgba(34,197,94,0.25), 8px 8px 18px var(--neo-shadow-d), -8px -8px 18px var(--neo-shadow-l)',
        }}
      >
        <span
          className="material-symbols-outlined animate-bounce-in"
          style={{ fontSize: 40, color: '#22c55e', fontVariationSettings: '"FILL" 1' }}
        >
          mark_email_read
        </span>
      </div>
      <h2 className="text-2xl font-black tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>
        Check your inbox
      </h2>
      <p className="text-sm leading-relaxed mb-1" style={{ color: 'var(--text-secondary)' }}>
        We sent a password reset link to
      </p>
      <p className="font-bold text-sm mb-6" style={{ color: 'var(--color-primary)' }}>
        {email}
      </p>
      <p className="text-xs mb-8" style={{ color: 'var(--text-muted)' }}>
        The link expires in <strong>1 hour</strong>. Check your spam folder if you don't see it.
      </p>
      <a
        href="/login"
        className="btn-glass btn-ripple px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-2"
        style={{ color: 'var(--text-primary)' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
        Back to sign in
      </a>
    </div>
  );
}

/* ─── Step 3: Set new password (arrived via email link ?token=...) ─────────── */
function SetNewPasswordStep({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [showCf, setShowCf]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState(false);

  const strength = (() => {
    if (password.length === 0) return 0;
    let score = 0;
    if (password.length >= 8)  score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][strength] ?? '';
  const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#10b981'][strength] ?? '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/password-reset/confirm', {
        token,
        new_password: password,
      });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'This reset link is invalid or has expired.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-8 sm:p-10 flex flex-col items-center text-center animate-fade-in-scale">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{
            background: 'rgba(34,197,94,0.12)',
            boxShadow: '0 0 32px rgba(34,197,94,0.25)',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 44, color: '#22c55e', fontVariationSettings: '"FILL" 1' }}
          >
            check_circle
          </span>
        </div>
        <h2 className="text-2xl font-black tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>
          Password updated!
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Redirecting you to sign in…
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 sm:p-10">
      <div className="flex flex-col items-center mb-8">
        <div
          className="skeu-icon-badge w-14 h-14 flex items-center justify-center mb-5"
          style={{ background: 'linear-gradient(145deg, #a855f7 0%, #6d28d9 100%)' }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 28, color: 'white', fontVariationSettings: '"FILL" 1' }}
          >
            key
          </span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-center" style={{ color: 'var(--text-primary)' }}>
          Set new password
        </h1>
        <p className="text-sm text-center mt-2" style={{ color: 'var(--text-secondary)' }}>
          Choose a strong password for your account.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm text-center flex items-center gap-2 justify-center animate-bounce-in"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
          {error}
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        {/* New password */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold tracking-wide ml-1" htmlFor="new-password"
            style={{ color: 'var(--text-secondary)' }}>
            New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>lock</span>
            </div>
            <input
              id="new-password"
              type={showPw ? 'text' : 'password'}
              required
              minLength={8}
              className="input-glass block w-full pl-11 pr-12 py-3.5 rounded-xl text-sm"
              style={{ color: 'var(--text-primary)' }}
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              tabIndex={-1}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                {showPw ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
          {/* Strength bar */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1,2,3,4,5].map(i => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full transition-all duration-400"
                    style={{ background: i <= strength ? strengthColor : 'var(--neo-shadow-d)' }}
                  />
                ))}
              </div>
              <p className="text-xs font-semibold ml-0.5" style={{ color: strengthColor }}>
                {strengthLabel}
              </p>
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold tracking-wide ml-1" htmlFor="confirm-password"
            style={{ color: 'var(--text-secondary)' }}>
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" style={{ color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>lock_clock</span>
            </div>
            <input
              id="confirm-password"
              type={showCf ? 'text' : 'password'}
              required
              minLength={8}
              className="input-glass block w-full pl-11 pr-12 py-3.5 rounded-xl text-sm"
              style={{
                color: 'var(--text-primary)',
                borderColor: confirm.length > 0
                  ? confirm === password ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'
                  : undefined,
              }}
              placeholder="Repeat your password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowCf(v => !v)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              tabIndex={-1}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                {showCf ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
          {confirm.length > 0 && confirm !== password && (
            <p className="text-xs ml-1 mt-0.5" style={{ color: '#ef4444' }}>Passwords do not match</p>
          )}
          {confirm.length > 0 && confirm === password && (
            <p className="text-xs ml-1 mt-0.5 flex items-center gap-1" style={{ color: '#22c55e' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check_circle</span>
              Passwords match
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || password.length < 8 || password !== confirm}
          className="skeu-btn-primary btn-ripple w-full flex justify-center items-center gap-2 py-4 rounded-xl font-bold text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>lock_reset</span>
              Reset Password
            </>
          )}
        </button>
      </form>
    </div>
  );
}

/* ─── Page shell ──────────────────────────────────────────────────────────── */
function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [sentEmail, setSentEmail] = useState<string | null>(null);

  // Decide which step to render:
  // 1. ?token=... in URL   → arrived from email → SetNewPasswordStep
  // 2. sentEmail set       → just submitted the request form → EmailSentStep
  // 3. otherwise           → show the request form → RequestResetStep
  const step: 'request' | 'sent' | 'set' =
    token ? 'set' : sentEmail ? 'sent' : 'request';

  return (
    <main className="min-h-screen relative overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <SpaceBackground />

      {/* Morphing blobs */}
      <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden">
        <div
          className="absolute morphing-blob"
          style={{
            width: '50vw', height: '50vw',
            maxWidth: 600, maxHeight: 600,
            top: '-10%', left: '-10%',
            background: 'radial-gradient(ellipse, rgba(10,132,255,0.15) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute morphing-blob-alt"
          style={{
            width: '40vw', height: '40vw',
            maxWidth: 480, maxHeight: 480,
            bottom: '5%', right: '-5%',
            background: 'radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 py-5 max-w-7xl mx-auto left-0 right-0">
        <a href="/" className="flex items-center gap-2.5 group">
          <div
            className="skeu-icon-badge w-9 h-9 flex items-center justify-center transition-transform duration-300 group-hover:rotate-12"
            style={{ background: 'linear-gradient(145deg, #1a9aff 0%, #0055cc 100%)' }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 18, color: 'white', fontVariationSettings: '"FILL" 1' }}
            >
              cloud_sync
            </span>
          </div>
          <span className="text-xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>PandaHub</span>
        </a>
      </header>

      {/* Card */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-24">
        <div
          className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-fade-in-up"
          style={{
            background: 'var(--glass-bg-3)',
            backdropFilter: 'blur(28px) saturate(1.9)',
            WebkitBackdropFilter: 'blur(28px) saturate(1.9)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.35)',
          }}
        >
          {step === 'request' && <RequestResetStep onSent={setSentEmail} />}
          {step === 'sent'    && <EmailSentStep email={sentEmail!} />}
          {step === 'set'     && <SetNewPasswordStep token={token!} />}
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
