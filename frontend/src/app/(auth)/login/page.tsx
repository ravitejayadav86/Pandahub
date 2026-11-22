"use client";

import { Suspense, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  GitBranch,
  Github,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

// OAuth redirects go directly to the backend because the callback URLs are
// registered against the backend origin, not the Next.js frontend proxy.
const BACKEND_OAUTH_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
  : 'http://localhost:8000/api/v1';

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#4285F4" d="M23.49 12.275c0-.79-.07-1.55-.2-2.275H12v4.51h6.47a5.53 5.53 0 0 1-2.39 3.63v3h3.87c2.26-2.09 3.54-5.17 3.54-8.865Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.87-3c-1.07.72-2.46 1.15-4.08 1.15-3.13 0-5.79-2.11-6.74-4.95H1.28v3.08A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.26 14.3a7.2 7.2 0 0 1 0-4.6V6.61H1.28a12 12 0 0 0 0 10.78l3.98-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.36.61 4.61 1.8l3.43-3.43A11.48 11.48 0 0 0 12 0 12 12 0 0 0 1.28 6.61l3.98 3.09C6.21 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

function LoginPageContent() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');

  const router = useRouter();
  const searchParams = useSearchParams();
  const fetchMe = useAuthStore(state => state.fetchMe);

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) {
      setError(oauthError.replace(/\+/g, ' '));
    }
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (challengeToken) {
        const { data } = await api.post('/auth/login/2fa', {
          challenge_token: challengeToken,
          totp_code: totpCode,
        });
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
      } else if (isLogin) {
        const { data } = await api.post('/auth/login', {
          username_or_email: email,
          password,
        });
        if (data.challenge_token) {
          setChallengeToken(data.challenge_token);
          setLoading(false);
          return;
        }
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
      } else {
        await api.post('/auth/register', { username, email, password });
        const { data } = await api.post('/auth/login', {
          username_or_email: email,
          password,
        });
        if (data.challenge_token) {
          setChallengeToken(data.challenge_token);
          setLoading(false);
          return;
        }
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
      }

      await fetchMe();
      setIsSuccess(true);
      window.setTimeout(() => router.push('/dashboard'), 1600);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        err.response?.data?.message ||
        (typeof err.response?.data === 'string' ? err.response.data : null) ||
        err.message ||
        'An error occurred. Please try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const startOAuth = (provider: 'github' | 'google') => {
    window.location.href = `${BACKEND_OAUTH_BASE}/auth/${provider}/login`;
  };

  return (
    <main className="ph-auth-page">
      <section className="ph-auth-card" aria-label="PandaHub account access">
        <aside className="ph-auth-aside">
          <div className="ph-auth-aside-content">
            <div className="ph-auth-eyebrow"><Sparkles size={15} /> YOUR DEVELOPMENT WORKSPACE</div>
            <h1>Make great work, <span>together.</span></h1>
            <p className="ph-auth-aside-copy">
              Keep your repositories, collaboration, and code reviews in one calm, organised workspace.
            </p>

            <div className="ph-auth-feature-list">
              <div className="ph-auth-feature">
                <span className="ph-auth-feature-icon"><GitBranch size={19} /></span>
                <span><strong>Code in one place</strong><small>Repositories, branches and pull requests</small></span>
              </div>
              <div className="ph-auth-feature">
                <span className="ph-auth-feature-icon"><UsersRound size={19} /></span>
                <span><strong>Work better together</strong><small>Issues, reviews and team collaboration</small></span>
              </div>
              <div className="ph-auth-feature">
                <span className="ph-auth-feature-icon"><Code2 size={19} /></span>
                <span><strong>Build with confidence</strong><small>Helpful AI-assisted code insights</small></span>
              </div>
            </div>
          </div>
          <div className="ph-auth-aside-footer">
            <ShieldCheck size={16} /> A clear space for your next great idea.
          </div>
          <div className="ph-auth-orbit ph-auth-orbit-one" aria-hidden="true" />
          <div className="ph-auth-orbit ph-auth-orbit-two" aria-hidden="true" />
        </aside>

        <div className="ph-auth-form-panel">
          <div className="ph-auth-form-inner">
            <div className="ph-auth-tabs" role="tablist" aria-label="Choose account action">
              <button
                type="button"
                role="tab"
                aria-selected={isLogin}
                className={isLogin ? 'active' : ''}
                onClick={() => { setIsLogin(true); setError(''); }}
                disabled={isSuccess || Boolean(challengeToken)}
              >Sign in</button>
              <button
                type="button"
                role="tab"
                aria-selected={!isLogin}
                className={!isLogin ? 'active' : ''}
                onClick={() => { setIsLogin(false); setError(''); }}
                disabled={isSuccess || Boolean(challengeToken)}
              >Create account</button>
            </div>

            {isSuccess ? (
              <div className="ph-auth-success" role="status">
                <div className="ph-auth-success-icon"><CheckCircle2 size={38} /></div>
                <h2>You’re all set.</h2>
                <p>Welcome to PandaHub. Taking you to your workspace…</p>
              </div>
            ) : challengeToken ? (
              <>
                <div className="ph-auth-heading">
                  <span className="ph-auth-kicker">ACCOUNT SECURITY</span>
                  <h2>Verify it’s you</h2>
                  <p>Enter the 6-digit code from your authenticator app.</p>
                </div>

                {error && <div className="ph-auth-error" role="alert">{error}</div>}

                <form className="ph-auth-form" onSubmit={handleSubmit}>
                  <label className="ph-auth-label" htmlFor="totpCode">Authentication code</label>
                  <div className="ph-auth-input-wrap">
                    <KeyRound size={18} aria-hidden="true" />
                    <input
                      id="totpCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Enter 6-digit code"
                      value={totpCode}
                      onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                    />
                  </div>
                  <button className="ph-auth-submit" type="submit" disabled={loading || totpCode.length !== 6}>
                    {loading ? <><LoaderCircle className="ph-auth-spinner" size={18} /> Verifying…</> : <>Verify code <ArrowRight size={17} /></>}
                  </button>
                  <button
                    type="button"
                    className="ph-auth-cancel"
                    onClick={() => { setChallengeToken(null); setTotpCode(''); setError(''); }}
                  >Back to sign in</button>
                </form>
              </>
            ) : (
              <>
                <div className="ph-auth-heading">
                  <span className="ph-auth-kicker">{isLogin ? 'WELCOME BACK' : 'GET STARTED'}</span>
                  <h2>{isLogin ? 'Sign in to PandaHub' : 'Create your account'}</h2>
                  <p>{isLogin ? 'Pick up where you left off.' : 'Your workspace is just a few details away.'}</p>
                </div>

                {error && <div className="ph-auth-error" role="alert">{error}</div>}

                <form className="ph-auth-form" onSubmit={handleSubmit}>
                  {!isLogin && (
                    <div className="ph-auth-field">
                      <label className="ph-auth-label" htmlFor="username">Username</label>
                      <div className="ph-auth-input-wrap">
                        <UserRound size={18} aria-hidden="true" />
                        <input
                          id="username"
                          type="text"
                          autoComplete="username"
                          placeholder="Choose a username"
                          value={username}
                          onChange={(event) => setUsername(event.target.value)}
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="ph-auth-field">
                    <label className="ph-auth-label" htmlFor="email">{isLogin ? 'Username or email' : 'Email address'}</label>
                    <div className="ph-auth-input-wrap">
                      <Mail size={18} aria-hidden="true" />
                      <input
                        id="email"
                        type={isLogin ? 'text' : 'email'}
                        autoComplete={isLogin ? 'username' : 'email'}
                        placeholder={isLogin ? 'Enter your username or email' : 'you@example.com'}
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="ph-auth-field">
                    <div className="ph-auth-label-row">
                      <label className="ph-auth-label" htmlFor="password">Password</label>
                      {isLogin && <Link className="ph-auth-forgot" href="/reset-password">Forgot password?</Link>}
                    </div>
                    <div className="ph-auth-input-wrap">
                      <LockKeyhole size={18} aria-hidden="true" />
                      <input
                        id="password"
                        type="password"
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                        placeholder={isLogin ? 'Enter your password' : 'Create a password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button className="ph-auth-submit" type="submit" disabled={loading}>
                    {loading
                      ? <><LoaderCircle className="ph-auth-spinner" size={18} /> Please wait…</>
                      : <>{isLogin ? 'Sign in to workspace' : 'Create account'} <ArrowRight size={17} /></>}
                  </button>
                </form>

                <div className="ph-auth-divider"><span>or continue with</span></div>
                <div className="ph-auth-socials">
                  <button type="button" onClick={() => startOAuth('github')} className="ph-auth-social">
                    <Github size={19} /> <span>GitHub</span>
                  </button>
                  <button type="button" onClick={() => startOAuth('google')} className="ph-auth-social">
                    <GoogleMark /> <span>Google</span>
                  </button>
                </div>
                <p className="ph-auth-secure-note"><ShieldCheck size={14} /> Secure sign-in to your PandaHub workspace</p>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="ph-auth-loading"><LoaderCircle className="ph-auth-spinner" size={26} /></div>}>
      <LoginPageContent />
    </Suspense>
  );
}
