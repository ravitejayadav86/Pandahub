'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { User } from '@/types';
import Navbar from '@/components/shared/Navbar';
import { QRCodeSVG } from 'qrcode.react';

type Section = 'profile' | 'education' | 'account' | 'tokens' | 'notifications' | 'danger';

const DEGREES = [
  'High School', "Associate's", "Bachelor's", "Master's",
  'PhD / Doctorate', 'Bootcamp', 'Self-taught', 'Other',
];

interface PATToken {
  id: string;
  name: string;
  scopes: string[];
  expires_at: string | null;
  created_at: string;
}

export default function SettingsPage() {
  const { user, setUser, fetchMe, clearAuth } = useAuthStore();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ── Profile form ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    username: '', first_name: '', last_name: '', full_name: '',
    bio: '', website_url: '', location: '',
  });

  // ── Education form ────────────────────────────────────────────────────────
  const [education, setEducation] = useState({
    institution: '', degree: '', field_of_study: '', graduation_year: '',
  });

  // ── Password form ─────────────────────────────────────────────────────────
  const [passwords, setPasswords] = useState({
    current_password: '', new_password: '', confirm_password: '',
  });

  // ── 2FA ───────────────────────────────────────────────────────────────────
  const [twoFaSetup, setTwoFaSetup] = useState<{ secret: string; provisioning_uri: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [twoFaError, setTwoFaError] = useState('');
  const [isTwoFaLoading, setIsTwoFaLoading] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  // ── PAT tokens ────────────────────────────────────────────────────────────
  const [tokens, setTokens] = useState<PATToken[]>([]);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenDays, setNewTokenDays] = useState('30');
  const [newTokenScopes, setNewTokenScopes] = useState<string[]>(['repo:read', 'repo:write']);
  const [createdToken, setCreatedToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState('');

  // ── Danger zone ───────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    if (user) {
      setProfile({
        username: user.username || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        full_name: user.full_name || '',
        bio: user.bio || '',
        website_url: user.website_url || user.website || '',
        location: user.location || '',
      });
      setEducation({
        institution: user.institution || '',
        degree: user.degree || '',
        field_of_study: user.field_of_study || '',
        graduation_year: user.graduation_year ? String(user.graduation_year) : '',
      });
    }
  }, [user]);

  // Load PAT tokens when switching to tokens section
  useEffect(() => {
    if (activeSection === 'tokens') loadTokens();
  }, [activeSection]);

  const loadTokens = async () => {
    try {
      const { data } = await api.get<PATToken[]>('/auth/tokens');
      setTokens(data);
    } catch { /* silent */ }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const full_name = `${profile.first_name} ${profile.last_name}`.trim() || profile.full_name;
      const { data } = await api.patch<User>('/auth/me', {
        username: profile.username || undefined,
        first_name: profile.first_name || undefined,
        last_name: profile.last_name || undefined,
        full_name: full_name || undefined,
        bio: profile.bio || undefined,
        website_url: profile.website_url || undefined,
        location: profile.location || undefined,
      });
      setUser(data);
      showSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save profile.');
    }
    setSaving(false);
  };

  const saveEducation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await api.patch<User>('/auth/me', {
        institution: education.institution || undefined,
        degree: education.degree || undefined,
        field_of_study: education.field_of_study || undefined,
        graduation_year: education.graduation_year ? Number(education.graduation_year) : undefined,
      });
      setUser(data);
      showSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save education info.');
    }
    setSaving(false);
  };

  const uploadAvatar = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post<User>('/auth/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(data);
    } catch { /* silent */ }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm_password) {
      setError('New passwords do not match.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
      showSaved();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update password.');
    }
    setSaving(false);
  };

  // 2FA
  const setupTwoFactor = async () => {
    setIsTwoFaLoading(true); setTwoFaError('');
    try {
      const { data } = await api.post('/auth/2fa/setup');
      setTwoFaSetup(data);
    } catch (err: any) { setTwoFaError(err.response?.data?.detail || 'Failed to setup 2FA'); }
    setIsTwoFaLoading(false);
  };

  const enableTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFaSetup) return;
    setIsTwoFaLoading(true); setTwoFaError('');
    try {
      await api.post(`/auth/2fa/enable?raw_secret=${twoFaSetup.secret}`, { totp_code: totpCode });
      setTwoFaSetup(null); setTotpCode('');
      if (user) setUser({ ...user, two_factor_enabled: true });
    } catch (err: any) { setTwoFaError(err.response?.data?.detail || 'Invalid verification code'); }
    setIsTwoFaLoading(false);
  };

  const disableTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTwoFaLoading(true); setTwoFaError('');
    try {
      await api.post('/auth/2fa/disable', { password: disablePassword, totp_code: totpCode });
      setDisablePassword(''); setTotpCode('');
      if (user) setUser({ ...user, two_factor_enabled: false });
    } catch (err: any) { setTwoFaError(err.response?.data?.detail || 'Failed to disable 2FA'); }
    setIsTwoFaLoading(false);
  };

  // PAT tokens
  const createToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setTokenError(''); setCreatedToken(''); setTokenLoading(true);
    try {
      const { data } = await api.post<{ token: string } & PATToken>('/auth/tokens', {
        name: newTokenName,
        scopes: newTokenScopes,
        expires_in_days: newTokenDays ? Number(newTokenDays) : null,
      });
      setCreatedToken(data.token);
      setNewTokenName(''); setNewTokenDays('30');
      await loadTokens();
    } catch (err: any) { setTokenError(err?.response?.data?.detail || 'Failed to create token.'); }
    setTokenLoading(false);
  };

  const revokeToken = async (id: string) => {
    try {
      await api.delete(`/auth/tokens/${id}`);
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch { /* silent */ }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputCls = 'block w-full px-4 py-3 bg-surface-container-low/50 input-glass border border-outline-variant/30 rounded-xl text-on-surface placeholder:text-outline focus:ring-0 text-sm font-medium glow-accent-focus transition-colors';
  const sectionHeaderCls = 'px-8 py-6 border-b border-outline-variant/20';
  const sectionBodyCls = 'px-8 py-7 flex flex-col gap-6';

  const SECTIONS: { id: Section; label: string; icon: string; danger?: boolean }[] = [
    { id: 'profile',       label: 'Profile',           icon: 'person' },
    { id: 'education',     label: 'Education',         icon: 'school' },
    { id: 'account',       label: 'Account & Security', icon: 'manage_accounts' },
    { id: 'tokens',        label: 'Access Tokens',     icon: 'key' },
    { id: 'notifications', label: 'Notifications',     icon: 'notifications' },
    { id: 'danger',        label: 'Danger Zone',       icon: 'warning', danger: true },
  ];

  const yearOptions = Array.from({ length: 50 }, (_, i) => String(new Date().getFullYear() + 5 - i));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-background text-on-surface font-body relative">
      {/* Ambient background */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary-container/5 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary-container/10 blur-[100px] pointer-events-none" />

      <Navbar />

      <div
        className="max-w-6xl mx-auto px-6 py-10 grid gap-8"
        style={{ gridTemplateColumns: '220px 1fr', opacity: mounted ? 1 : 0, transition: 'opacity 0.4s' }}
      >
        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <nav className="sticky top-24 h-fit">
          <p className="text-[11px] font-bold tracking-widest text-on-surface-variant uppercase mb-3 pl-3">Settings</p>
          <div className="flex flex-col gap-1">
            {SECTIONS.map((s) => {
              const active = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => { setActiveSection(s.id); setError(''); }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left
                    ${active
                      ? s.danger ? 'bg-error/10 text-error' : 'bg-primary text-white shadow-[0_4px_14px_rgba(10,132,255,0.3)]'
                      : s.danger ? 'text-error hover:bg-error/5' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/60'
                    }`}
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: active ? '"FILL" 1' : '"FILL" 0' }}>
                    {s.icon}
                  </span>
                  {s.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content panel ────────────────────────────────────────────────── */}
        <div className="glass-panel card-glow rounded-3xl border border-white/10 shadow-[0_8px_40px_rgb(0,0,0,0.08)] overflow-hidden">

          {/* ───────────── PROFILE ───────────── */}
          {activeSection === 'profile' && (
            <div>
              <div className={sectionHeaderCls}>
                <h2 className="text-xl font-bold">Public Profile</h2>
                <p className="text-sm text-on-surface-variant mt-1">This information is displayed on your public profile page.</p>
              </div>
              <form onSubmit={saveProfile} className={sectionBodyCls}>
                {/* Avatar row */}
                <div className="flex items-center gap-5">
                  <div
                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 overflow-hidden cursor-pointer ring-2 ring-primary/20 hover:ring-primary/50 transition-all"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {user?.avatar_url
                      ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-3xl font-extrabold text-white">{user?.username?.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">{user?.username}</p>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="text-sm text-primary font-semibold hover:underline"
                    >
                      Upload new avatar
                    </button>
                    <p className="text-xs text-on-surface-variant mt-0.5">JPG, PNG, GIF · Max 2 MB</p>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { if (e.target.files?.[0]) uploadAvatar(e.target.files[0]); }}
                    />
                  </div>
                </div>

                {/* Username */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold" htmlFor="set-username">Username</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm select-none">pandahub.dev/</span>
                    <input
                      id="set-username"
                      type="text"
                      value={profile.username}
                      onChange={(e) => setProfile({ ...profile, username: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                      className={`${inputCls} pl-[8.5rem]`}
                    />
                  </div>
                  <p className="text-xs text-on-surface-variant">Changing your username will break existing clone URLs.</p>
                </div>

                {/* First / Last name */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold" htmlFor="set-firstname">First Name</label>
                    <input id="set-firstname" type="text" value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} placeholder="Ada" className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold" htmlFor="set-lastname">Last Name</label>
                    <input id="set-lastname" type="text" value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} placeholder="Lovelace" className={inputCls} />
                  </div>
                </div>

                {/* Bio */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold" htmlFor="set-bio">Bio</label>
                  <textarea
                    id="set-bio"
                    rows={3}
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    placeholder="Tell the world a bit about yourself…"
                    className={`${inputCls} resize-none`}
                    maxLength={500}
                  />
                  <p className="text-xs text-on-surface-variant text-right">{profile.bio.length}/500</p>
                </div>

                {/* Website + Location */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold" htmlFor="set-website">Website</label>
                    <input id="set-website" type="url" value={profile.website_url} onChange={(e) => setProfile({ ...profile, website_url: e.target.value })} placeholder="https://yoursite.com" className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold" htmlFor="set-location">Location</label>
                    <input id="set-location" type="text" value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} placeholder="City, Country" className={inputCls} />
                  </div>
                </div>

                {error && <ErrorBanner msg={error} />}

                <div className="flex items-center gap-3 pt-2">
                  <button type="submit" disabled={saving} id="save-profile-btn" className="btn-primary btn-ripple px-7 py-3 text-sm disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save profile'}
                  </button>
                  {saved && <span className="text-sm text-green-500 font-semibold animate-fade-in-up">✓ Saved!</span>}
                </div>
              </form>
            </div>
          )}

          {/* ───────────── EDUCATION ───────────── */}
          {activeSection === 'education' && (
            <div>
              <div className={sectionHeaderCls}>
                <h2 className="text-xl font-bold">Education</h2>
                <p className="text-sm text-on-surface-variant mt-1">Your academic background — shown on your public profile.</p>
              </div>
              <form onSubmit={saveEducation} className={sectionBodyCls}>
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold" htmlFor="set-institution">Institution / University</label>
                  <input
                    id="set-institution"
                    type="text"
                    value={education.institution}
                    onChange={(e) => setEducation({ ...education, institution: e.target.value })}
                    placeholder="e.g. IIT Bombay, Stanford University"
                    className={inputCls}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold" htmlFor="set-degree">Degree</label>
                    <select
                      id="set-degree"
                      value={education.degree}
                      onChange={(e) => setEducation({ ...education, degree: e.target.value })}
                      className={`${inputCls} appearance-none cursor-pointer`}
                    >
                      <option value="">Select degree…</option>
                      {DEGREES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold" htmlFor="set-grad-year">Graduation Year</label>
                    <select
                      id="set-grad-year"
                      value={education.graduation_year}
                      onChange={(e) => setEducation({ ...education, graduation_year: e.target.value })}
                      className={`${inputCls} appearance-none cursor-pointer`}
                    >
                      <option value="">Select year…</option>
                      {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-bold" htmlFor="set-field">Field of Study</label>
                  <input
                    id="set-field"
                    type="text"
                    value={education.field_of_study}
                    onChange={(e) => setEducation({ ...education, field_of_study: e.target.value })}
                    placeholder="e.g. Computer Science, Data Science, MBA"
                    className={inputCls}
                  />
                </div>

                {error && <ErrorBanner msg={error} />}

                <div className="flex items-center gap-3 pt-2">
                  <button type="submit" disabled={saving} id="save-education-btn" className="btn-primary btn-ripple px-7 py-3 text-sm disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save education'}
                  </button>
                  {saved && <span className="text-sm text-green-500 font-semibold animate-fade-in-up">✓ Saved!</span>}
                </div>
              </form>
            </div>
          )}

          {/* ───────────── ACCOUNT & SECURITY ───────────── */}
          {activeSection === 'account' && (
            <div>
              <div className={sectionHeaderCls}>
                <h2 className="text-xl font-bold">Account &amp; Security</h2>
                <p className="text-sm text-on-surface-variant mt-1">Manage your credentials and two-factor authentication.</p>
              </div>
              <div className={sectionBodyCls}>
                {/* Email (read-only) */}
                <InfoRow label="Email" value={user?.email || '—'} icon="mail" />
                <InfoRow label="Member since" value={user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} icon="calendar_today" />
                <InfoRow label="Verified" value={user?.is_verified ? 'Yes ✓' : 'No — check your email'} icon="verified_user" />

                <hr className="border-outline-variant/20" />

                {/* Change password */}
                <div>
                  <h3 className="text-base font-bold mb-4">Change Password</h3>
                  <form onSubmit={changePassword} className="flex flex-col gap-4">
                    {[
                      { key: 'current_password', label: 'Current password',  placeholder: 'Enter current password' },
                      { key: 'new_password',      label: 'New password',      placeholder: 'Minimum 8 characters' },
                      { key: 'confirm_password',  label: 'Confirm password',  placeholder: 'Repeat new password' },
                    ].map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <label className="block text-sm font-bold" htmlFor={`pwd-${f.key}`}>{f.label}</label>
                        <input
                          id={`pwd-${f.key}`}
                          type="password"
                          value={passwords[f.key as keyof typeof passwords]}
                          onChange={(e) => setPasswords({ ...passwords, [f.key]: e.target.value })}
                          placeholder={f.placeholder}
                          required
                          className={inputCls}
                        />
                      </div>
                    ))}
                    {error && <ErrorBanner msg={error} />}
                    <div className="flex items-center gap-3">
                      <button type="submit" disabled={saving} className="btn-primary btn-ripple px-7 py-3 text-sm disabled:opacity-50">
                        {saving ? 'Updating…' : 'Update password'}
                      </button>
                      {saved && <span className="text-sm text-green-500 font-semibold">✓ Updated!</span>}
                    </div>
                  </form>
                </div>

                <hr className="border-outline-variant/20" />

                {/* 2FA */}
                <div>
                  <h3 className="text-base font-bold mb-2">Two-Factor Authentication</h3>
                  {user?.two_factor_enabled ? (
                    <div>
                      <div className="flex items-center gap-2 mb-4 text-green-500 font-semibold text-sm">
                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                        2FA is enabled
                      </div>
                      <form onSubmit={disableTwoFactor} className="p-5 bg-surface-container-low/40 rounded-2xl border border-outline-variant/20 flex flex-col gap-3">
                        <p className="text-sm text-on-surface-variant">To disable 2FA, enter your password and a current 6-digit code.</p>
                        {twoFaError && <ErrorBanner msg={twoFaError} />}
                        <input type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} placeholder="Current password" required className={inputCls} />
                        <input type="text" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" required className={`${inputCls} tracking-widest font-mono`} maxLength={6} />
                        <button type="submit" disabled={isTwoFaLoading || totpCode.length !== 6 || !disablePassword} className="self-start px-6 py-2.5 rounded-xl bg-error text-white font-bold text-sm disabled:opacity-50 transition-opacity">
                          {isTwoFaLoading ? 'Disabling…' : 'Disable 2FA'}
                        </button>
                      </form>
                    </div>
                  ) : twoFaSetup ? (
                    <form onSubmit={enableTwoFactor} className="p-5 bg-surface-container-low/40 rounded-2xl border border-outline-variant/20 flex flex-col gap-4">
                      <p className="text-sm font-semibold">Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy)</p>
                      <div className="p-4 bg-white rounded-2xl inline-block border border-outline-variant/20">
                        <QRCodeSVG value={twoFaSetup.provisioning_uri} size={150} />
                      </div>
                      {twoFaError && <ErrorBanner msg={twoFaError} />}
                      <div className="space-y-1.5">
                        <label className="block text-sm font-bold">Verify Code</label>
                        <input type="text" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" required className={`${inputCls} tracking-widest font-mono max-w-[200px]`} maxLength={6} />
                      </div>
                      <div className="flex gap-3">
                        <button type="submit" disabled={isTwoFaLoading || totpCode.length !== 6} className="btn-primary btn-ripple px-6 py-2.5 text-sm disabled:opacity-50">
                          {isTwoFaLoading ? 'Enabling…' : 'Enable 2FA'}
                        </button>
                        <button type="button" onClick={() => { setTwoFaSetup(null); setTotpCode(''); setTwoFaError(''); }} className="px-6 py-2.5 rounded-xl border border-outline-variant/30 text-sm font-semibold hover:bg-surface-container-low/50 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div>
                      <p className="text-sm text-on-surface-variant mb-4">
                        Protect your account with an authenticator app. You&apos;ll be asked for a code each time you sign in.
                      </p>
                      <button onClick={setupTwoFactor} disabled={isTwoFaLoading} className="px-6 py-2.5 rounded-xl border border-outline-variant/30 text-sm font-semibold hover:bg-surface-container-low/50 transition-colors flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">security</span>
                        {isTwoFaLoading ? 'Loading…' : 'Set up two-factor authentication'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ───────────── ACCESS TOKENS ───────────── */}
          {activeSection === 'tokens' && (
            <div>
              <div className={sectionHeaderCls}>
                <h2 className="text-xl font-bold">Personal Access Tokens</h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  Use tokens to authenticate with the <code className="bg-surface-container px-1.5 py-0.5 rounded text-primary text-xs">panda</code> CLI or git-over-HTTPS.
                </p>
              </div>
              <div className={sectionBodyCls}>
                {/* Create token form */}
                <div className="p-5 bg-surface-container-low/40 rounded-2xl border border-outline-variant/20">
                  <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">add_circle</span>
                    Generate new token
                  </h3>
                  <form onSubmit={createToken} className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-bold" htmlFor="token-name">Token name</label>
                      <input id="token-name" type="text" value={newTokenName} onChange={(e) => setNewTokenName(e.target.value)} placeholder="e.g. laptop-dev, ci-pipeline" required className={inputCls} />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-sm font-bold">Scopes</label>
                      <div className="flex flex-wrap gap-2">
                        {['repo:read', 'repo:write', 'repo:admin', 'user:read'].map((scope) => (
                          <label key={scope} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${newTokenScopes.includes(scope) ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/30 text-on-surface-variant hover:border-outline-variant'}`}>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={newTokenScopes.includes(scope)}
                              onChange={(e) => setNewTokenScopes(e.target.checked ? [...newTokenScopes, scope] : newTokenScopes.filter((s) => s !== scope))}
                            />
                            {scope}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-sm font-bold" htmlFor="token-expires">Expiration</label>
                      <select id="token-expires" value={newTokenDays} onChange={(e) => setNewTokenDays(e.target.value)} className={`${inputCls} appearance-none cursor-pointer max-w-xs`}>
                        <option value="7">7 days</option>
                        <option value="30">30 days</option>
                        <option value="90">90 days</option>
                        <option value="365">1 year</option>
                        <option value="">No expiration</option>
                      </select>
                    </div>

                    {tokenError && <ErrorBanner msg={tokenError} />}

                    <button type="submit" disabled={tokenLoading || !newTokenName || newTokenScopes.length === 0} className="btn-primary btn-ripple self-start px-6 py-2.5 text-sm disabled:opacity-50">
                      {tokenLoading ? 'Creating…' : 'Generate token'}
                    </button>
                  </form>

                  {/* Newly created token — show once */}
                  {createdToken && (
                    <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                      <p className="text-xs font-bold text-green-600 mb-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                        Token created — copy it now, it won&apos;t be shown again
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-surface-container px-3 py-2 rounded-lg flex-1 overflow-x-auto select-all font-mono break-all">{createdToken}</code>
                        <button
                          onClick={() => navigator.clipboard.writeText(createdToken)}
                          className="shrink-0 p-2 rounded-lg hover:bg-surface-container-high transition-colors"
                          title="Copy"
                        >
                          <span className="material-symbols-outlined text-[18px]">content_copy</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Token list */}
                <div>
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">list</span>
                    Active tokens ({tokens.length})
                  </h3>
                  {tokens.length === 0
                    ? <p className="text-sm text-on-surface-variant">No active tokens yet.</p>
                    : (
                      <div className="flex flex-col gap-2">
                        {tokens.map((t) => (
                          <div key={t.id} className="flex items-center justify-between p-4 rounded-xl bg-surface-container-low/40 border border-outline-variant/20">
                            <div>
                              <div className="font-semibold text-sm">{t.name}</div>
                              <div className="text-xs text-on-surface-variant mt-0.5">
                                {t.scopes.join(', ')} ·{' '}
                                {t.expires_at
                                  ? `Expires ${new Date(t.expires_at).toLocaleDateString()}`
                                  : 'Never expires'}
                              </div>
                            </div>
                            <button
                              onClick={() => revokeToken(t.id)}
                              className="ml-4 text-xs font-bold text-error hover:underline px-3 py-1.5 rounded-lg hover:bg-error/10 transition-colors"
                            >
                              Revoke
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              </div>
            </div>
          )}

          {/* ───────────── NOTIFICATIONS ───────────── */}
          {activeSection === 'notifications' && (
            <div>
              <div className={sectionHeaderCls}>
                <h2 className="text-xl font-bold">Notifications</h2>
                <p className="text-sm text-on-surface-variant mt-1">Choose what you are notified about.</p>
              </div>
              <div className="px-8 py-7 flex flex-col divide-y divide-outline-variant/20">
                {[
                  { label: 'Push commits to your repository', detail: 'When someone pushes to a repo you own',   on: true  },
                  { label: 'New issues',                      detail: 'When someone opens a new issue',          on: true  },
                  { label: 'Pull request reviews',            detail: 'Review requests and approvals',           on: true  },
                  { label: 'Pull request merges',             detail: 'When a PR is merged or closed',          on: false },
                  { label: 'Mentions',                        detail: 'When someone @mentions you',             on: true  },
                  { label: 'Stars',                           detail: 'When someone stars your repository',     on: false },
                  { label: 'New followers',                   detail: 'When someone follows your profile',      on: true  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-4">
                    <div>
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="text-xs text-on-surface-variant mt-0.5">{item.detail}</div>
                    </div>
                    {/* Static toggle — functional toggle would need DB-backed prefs */}
                    <div className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${item.on ? 'bg-primary' : 'bg-surface-container-high'}`}>
                      <div className={`w-[18px] h-[18px] rounded-full bg-white absolute top-[3px] transition-all shadow ${item.on ? 'left-[23px]' : 'left-[3px]'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ───────────── DANGER ZONE ───────────── */}
          {activeSection === 'danger' && (
            <div>
              <div className={sectionHeaderCls}>
                <h2 className="text-xl font-bold text-error">Danger Zone</h2>
                <p className="text-sm text-on-surface-variant mt-1">These actions are irreversible. Proceed with extreme caution.</p>
              </div>
              <div className={sectionBodyCls}>
                <div className="p-5 rounded-2xl border border-error/30 flex items-center justify-between gap-6">
                  <div>
                    <h3 className="font-bold text-error mb-1">Delete account</h3>
                    <p className="text-sm text-on-surface-variant">Permanently removes your account, all repositories, and all associated data.</p>
                  </div>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="shrink-0 px-5 py-2.5 rounded-xl bg-error text-white font-bold text-sm hover:bg-error/90 transition-colors"
                  >
                    Delete account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel rounded-3xl p-8 max-w-md w-full shadow-[0_30px_80px_rgba(0,0,0,0.3)] border border-white/10">
            <h3 className="text-xl font-bold text-error mb-3">Delete your account?</h3>
            <p className="text-sm text-on-surface-variant mb-5 leading-relaxed">
              This will permanently delete your account and all associated data. Type{' '}
              <strong className="text-on-surface">{user?.username}</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={user?.username}
              className={`${inputCls} mb-5`}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 rounded-xl border border-outline-variant/30 font-semibold text-sm hover:bg-surface-container-low/50 transition-colors">
                Cancel
              </button>
              <button
                disabled={deleteConfirm !== user?.username}
                onClick={() => { clearAuth(); router.push('/'); }}
                className="flex-1 py-3 rounded-xl bg-error text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-error/90 transition-colors"
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Small helper components ──────────────────────────────────────────────────
function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm font-medium">
      <span className="material-symbols-outlined text-[18px]">error</span>
      {msg}
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
        {label}
      </div>
      <span className="text-sm font-semibold text-on-surface">{value}</span>
    </div>
  );
}