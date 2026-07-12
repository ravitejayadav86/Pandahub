'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register, login } from '@/lib/auth';
import { useAuthStore } from '@/store/authStore';

export default function RegisterPage() {
  const router = useRouter();
  const { fetchMe } = useAuthStore();
  const [form, setForm] = useState({
    username: '', email: '', password: '', confirmPassword: '', full_name: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await register(form.username, form.email, form.password, form.full_name || undefined);
      await login(form.username, form.password);
      await fetchMe();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card animate-fade-in" style={{
      width: '100%', maxWidth: 460, padding: '40px 36px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🐼</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Create your account</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 14 }}>
          Join PandaHub and start building
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={labelStyle}>Username *</label>
            <input
              id="reg-username"
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, '') })}
              required
              placeholder="johndoe"
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Full name</label>
            <input
              id="reg-fullname"
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="John Doe"
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Email *</label>
          <input
            id="reg-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            placeholder="john@example.com"
            style={inputStyle}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Password *</label>
          <input
            id="reg-password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            placeholder="Min. 8 characters"
            style={inputStyle}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Confirm password *</label>
          <input
            id="reg-confirm-password"
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            required
            placeholder="••••••••"
            style={inputStyle}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: 'rgba(248, 81, 73, 0.1)',
            border: '1px solid rgba(248, 81, 73, 0.3)',
            color: 'var(--accent-red)', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <button
          id="reg-submit"
          type="submit"
          disabled={loading}
          style={{
            ...buttonStyle,
            marginTop: 8,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '⏳ Creating account…' : '🐼 Create account'}
        </button>
      </form>

      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 28, paddingTop: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--brand-accent)', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 6, fontSize: 13,
  fontWeight: 600, color: 'var(--text-secondary)',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-color)',
  borderRadius: 8, color: 'var(--text-primary)',
  fontSize: 14, outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};
const focusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = 'var(--brand-primary)';
  e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.15)';
};
const blurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = 'var(--border-color)';
  e.target.style.boxShadow = 'none';
};
const buttonStyle: React.CSSProperties = {
  width: '100%', padding: '12px',
  background: 'var(--gradient-brand)',
  border: 'none', borderRadius: 8,
  color: '#fff', fontWeight: 700, fontSize: 15,
  boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
  transition: 'opacity 0.15s',
};
