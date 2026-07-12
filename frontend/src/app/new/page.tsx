'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Repository } from '@/types';
import { useAuthStore } from '@/store/authStore';

export default function NewRepoPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [form, setForm] = useState({
    name: '',
    description: '',
    visibility: 'public' as 'public' | 'private',
    auto_init: true,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<Repository>('/repos', form);
      router.push(`/${user?.username}/${data.name}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create repository');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', padding: '16px 0' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/dashboard" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>← Dashboard</Link>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Create a new repository</span>
        </div>
      </div>

      <div className="container" style={{ maxWidth: 680, padding: '40px 1.5rem' }}>
        <div className="glass-card animate-fade-in" style={{ padding: '36px 40px' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 6 }}>
            📦 New repository
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32 }}>
            A repository contains all your project's files and revision history.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Owner + name */}
            <div>
              <label style={labelStyle}>Repository name *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  padding: '10px 14px', background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)', borderRadius: 8,
                  color: 'var(--text-secondary)', fontSize: 14,
                }}>
                  {user?.username}
                </div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>/</span>
                <input
                  id="new-repo-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="my-awesome-project"
                  style={{ ...inputStyle, flex: 1 }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--brand-primary)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; }}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
              <input
                id="new-repo-desc"
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="A short description of your project"
                style={inputStyle}
              />
            </div>

            {/* Visibility */}
            <div>
              <label style={labelStyle}>Visibility</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  { value: 'public', icon: '🌍', title: 'Public', desc: 'Anyone can see this repository.' },
                  { value: 'private', icon: '🔒', title: 'Private', desc: 'Only you can access this repository.' },
                ] as const).map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px', borderRadius: 10,
                      border: `1px solid ${form.visibility === opt.value ? 'rgba(124,58,237,0.4)' : 'var(--border-color)'}`,
                      background: form.visibility === opt.value ? 'rgba(124,58,237,0.08)' : 'var(--bg-tertiary)',
                      cursor: 'pointer', transition: 'all var(--transition-fast)',
                    }}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={opt.value}
                      checked={form.visibility === opt.value}
                      onChange={() => setForm({ ...form, visibility: opt.value })}
                      style={{ accentColor: 'var(--brand-primary)' }}
                    />
                    <span style={{ fontSize: 20 }}>{opt.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{opt.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Initialize repo */}
            <div style={{
              padding: '16px', borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.auto_init}
                  onChange={(e) => setForm({ ...form, auto_init: e.target.checked })}
                  style={{ accentColor: 'var(--brand-primary)', width: 16, height: 16 }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Initialize with a README</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Creates an initial commit with a README.md file.
                  </div>
                </div>
              </label>
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

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 24 }}>
              <button
                id="create-repo-submit"
                type="submit"
                disabled={loading || !form.name}
                style={{
                  padding: '12px 28px', borderRadius: 8,
                  background: 'var(--gradient-brand)',
                  color: '#fff', fontWeight: 700, fontSize: 15,
                  border: 'none', cursor: loading || !form.name ? 'not-allowed' : 'pointer',
                  opacity: loading || !form.name ? 0.6 : 1,
                  boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                }}
              >
                {loading ? '⏳ Creating…' : '📦 Create repository'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 8, fontSize: 14,
  fontWeight: 600, color: 'var(--text-secondary)',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-color)',
  borderRadius: 8, color: 'var(--text-primary)',
  fontSize: 14, outline: 'none',
  transition: 'border-color 0.15s',
};
