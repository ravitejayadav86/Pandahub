'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { User } from '@/types';
import Navbar from '@/components/shared/Navbar';

type Section = 'profile' | 'account' | 'notifications' | 'danger';

export default function SettingsPage() {
  const { user, setUser, clearAuth } = useAuthStore();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [profile, setProfile] = useState({ full_name: '', bio: '', website: '', location: '', company: '' });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (user) {
      setProfile({ full_name: user.full_name || '', bio: user.bio || '', website: user.website || '', location: user.location || '', company: user.company || '' });
    }
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.patch<User>('/auth/me', profile);
      setUser(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm_password) return alert('Passwords do not match');
    setSaving(true);
    try {
      await api.post('/auth/change-password', { current_password: passwords.current_password, new_password: passwords.new_password });
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  };

  const SECTIONS: { id: Section; label: string; icon: string }[] = [
    { id: 'profile',       label: 'Profile',        icon: 'person' },
    { id: 'account',       label: 'Account',        icon: 'manage_accounts' },
    { id: 'notifications', label: 'Notifications',  icon: 'notifications' },
    { id: 'danger',        label: 'Danger Zone',    icon: 'warning' },
  ];

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--border-color)', fontSize: 14, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', transition: 'border-color 0.15s' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'Inter, sans-serif' }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px', opacity: mounted ? 1 : 0, transition: 'opacity 0.4s', display: 'grid', gridTemplateColumns: '240px 1fr', gap: 32 }}>

        {/* Sidebar Nav */}
        <nav style={{ position: 'sticky', top: 80, height: 'fit-content' }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingLeft: 12 }}>Settings</h2>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', borderRadius: 9,
              fontSize: 14, fontWeight: activeSection === s.id ? 600 : 400,
              background: activeSection === s.id ? (s.id === 'danger' ? '#fef2f2' : 'var(--text-primary)') : 'transparent',
              color: activeSection === s.id ? (s.id === 'danger' ? '#ef4444' : '#fff') : (s.id === 'danger' ? '#ef4444' : 'var(--text-secondary)'),
              border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', marginBottom: 2,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          {activeSection === 'profile' && (
            <div>
              <div style={{ padding: '28px 32px', borderBottom: '1px solid var(--border-color)' }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Public Profile</h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '6px 0 0' }}>This information will be displayed publicly.</p>
              </div>
              <form onSubmit={saveProfile} style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Avatar Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {user?.avatar_url
                      ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{user?.username?.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{user?.username}</div>
                    <button type="button" style={{ fontSize: 13, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>Upload new avatar</button>
                  </div>
                </div>

                {[
                  { key: 'full_name', label: 'Full Name', placeholder: 'Your full name' },
                  { key: 'bio',       label: 'Bio',       placeholder: 'A short bio about yourself', multiline: true },
                  { key: 'website',   label: 'Website',   placeholder: 'https://yoursite.com' },
                  { key: 'location',  label: 'Location',  placeholder: 'City, Country' },
                  { key: 'company',   label: 'Company',   placeholder: 'Your company or organization' },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{field.label}</label>
                    {field.multiline
                      ? <textarea value={profile[field.key as keyof typeof profile]} onChange={e => setProfile({...profile, [field.key]: e.target.value})} placeholder={field.placeholder} rows={3}
                          style={{ ...inputStyle, resize: 'vertical' }} />
                      : <input type="text" value={profile[field.key as keyof typeof profile]} onChange={e => setProfile({...profile, [field.key]: e.target.value})} placeholder={field.placeholder}
                          style={inputStyle}
                          onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'var(--color-primary)'}
                          onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border-color)'}
                        />
                    }
                  </div>
                ))}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8 }}>
                  <button type="submit" disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--text-primary)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
                    {saving ? 'Saving…' : 'Save profile'}
                  </button>
                  {saved && <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>✓ Saved!</span>}
                </div>
              </form>
            </div>
          )}

          {activeSection === 'account' && (
            <div>
              <div style={{ padding: '28px 32px', borderBottom: '1px solid var(--border-color)' }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Account</h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '6px 0 0' }}>Manage your account credentials.</p>
              </div>
              <form onSubmit={changePassword} style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Email</div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{user?.email || '—'}</div>
                </div>
                <div style={{ height: 1, background: 'var(--border-color)' }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Change Password</h3>
                {[
                  { key: 'current_password', label: 'Current password', placeholder: 'Enter current password' },
                  { key: 'new_password',     label: 'New password',     placeholder: 'Minimum 8 characters' },
                  { key: 'confirm_password', label: 'Confirm password', placeholder: 'Repeat new password' },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{field.label}</label>
                    <input type="password" value={passwords[field.key as keyof typeof passwords]} onChange={e => setPasswords({...passwords, [field.key]: e.target.value})} placeholder={field.placeholder} required
                      style={inputStyle}
                      onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'var(--color-primary)'}
                      onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border-color)'}
                    />
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button type="submit" disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--text-primary)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
                    {saving ? 'Updating…' : 'Update password'}
                  </button>
                  {saved && <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>✓ Updated!</span>}
                </div>
              </form>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div>
              <div style={{ padding: '28px 32px', borderBottom: '1px solid var(--border-color)' }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Notifications</h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '6px 0 0' }}>Choose what you are notified about.</p>
              </div>
              <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { label: 'Push commits to your repository', detail: 'When someone pushes to a repo you own', enabled: true },
                  { label: 'New issues',                      detail: 'When someone opens a new issue',          enabled: true },
                  { label: 'Pull request reviews',            detail: 'Review requests and approvals',           enabled: true },
                  { label: 'Pull request merges',             detail: 'When a PR is merged or closed',          enabled: false },
                  { label: 'Mentions',                        detail: 'When someone @mentions you',             enabled: true },
                  { label: 'Stars',                           detail: 'When someone stars your repository',     enabled: false },
                ].map((item, i, arr) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.detail}</div>
                    </div>
                    <div style={{ width: 44, height: 24, borderRadius: 12, background: item.enabled ? 'var(--color-primary)' : '#e2e8f0', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: item.enabled ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'danger' && (
            <div>
              <div style={{ padding: '28px 32px', borderBottom: '1px solid var(--border-color)' }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#ef4444' }}>Danger Zone</h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '6px 0 0' }}>These actions are irreversible. Please proceed with caution.</p>
              </div>
              <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ border: '1px solid #fecaca', borderRadius: 12, padding: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#ef4444', margin: 0 }}>Delete account</h3>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}>Once deleted, your account and all data will be permanently removed.</p>
                    </div>
                    <button onClick={() => setShowDeleteModal(true)} style={{ padding: '9px 20px', borderRadius: 9, background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                      Delete account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#ef4444' }}>Delete your account?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>This will permanently delete your account and all associated data. Type <strong>{user?.username}</strong> to confirm.</p>
            <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={user?.username}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 9, border: '1px solid #fecaca', fontSize: 14, outline: 'none', marginBottom: 20, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDeleteModal(false)} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid var(--border-color)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button disabled={deleteConfirm !== user?.username} onClick={() => { clearAuth(); router.push('/'); }} style={{ flex: 1, padding: '10px', borderRadius: 9, background: deleteConfirm === user?.username ? '#ef4444' : '#fca5a5', color: '#fff', fontWeight: 700, border: 'none', cursor: deleteConfirm === user?.username ? 'pointer' : 'not-allowed' }}>
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}