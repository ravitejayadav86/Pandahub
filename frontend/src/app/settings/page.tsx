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

// ─── Small helper components ──────────────────────────────────────────────────

function SettingSection({
  title, description, children,
}: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <section className="gh-section">
      <div className="gh-section-header">
        <h2 className="gh-section-title">{title}</h2>
        {description && <p className="gh-section-desc">{description}</p>}
      </div>
      <div className="gh-section-body">{children}</div>
    </section>
  );
}

function FormGroup({
  label, hint, children, htmlFor,
}: {
  label: string; hint?: string; children: React.ReactNode; htmlFor?: string;
}) {
  return (
    <div className="gh-form-group">
      <label className="gh-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="gh-hint">{hint}</p>}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="gh-error-banner">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
      </svg>
      {msg}
    </div>
  );
}

function SaveSuccess() {
  return (
    <span className="gh-save-ok">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
      </svg>
      Saved successfully
    </span>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="gh-info-row">
      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>
      <span className="gh-info-label">{label}</span>
      <span className="gh-info-value">{value}</span>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, setUser, clearAuth } = useAuthStore();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ── Profile ───────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    username: '', first_name: '', last_name: '', full_name: '',
    bio: '', website_url: '', location: '',
  });

  // ── Education ─────────────────────────────────────────────────────────────
  const [education, setEducation] = useState({
    institution: '', degree: '', field_of_study: '', graduation_year: '',
  });

  // ── Password ──────────────────────────────────────────────────────────────
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

  // ── Notifications ─────────────────────────────────────────────────────────
  type NotifKey = 'commits' | 'issues' | 'pr_reviews' | 'pr_merges' | 'mentions' | 'stars' | 'followers';
  const DEFAULT_NOTIF: Record<NotifKey, boolean> = {
    commits: true, issues: true, pr_reviews: true,
    pr_merges: false, mentions: true, stars: false, followers: true,
  };
  const [notifPrefs, setNotifPrefs] = useState<Record<NotifKey, boolean>>(DEFAULT_NOTIF);

  // ── Danger ────────────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    try {
      const s = localStorage.getItem('pandahub_notif_prefs');
      if (s) setNotifPrefs(JSON.parse(s));
    } catch { /* ignore */ }
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

  useEffect(() => {
    if (activeSection === 'tokens') loadTokens();
  }, [activeSection]);

  const loadTokens = async () => {
    try {
      const { data } = await api.get<PATToken[]>('/auth/tokens');
      setTokens(data);
    } catch { /* silent */ }
  };

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
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
      setUser(data); showSaved();
    } catch (err: any) { setError(err?.response?.data?.detail || 'Failed to save profile.'); }
    setSaving(false);
  };

  const saveEducation = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const { data } = await api.patch<User>('/auth/me', {
        institution: education.institution || undefined,
        degree: education.degree || undefined,
        field_of_study: education.field_of_study || undefined,
        graduation_year: education.graduation_year ? Number(education.graduation_year) : undefined,
      });
      setUser(data); showSaved();
    } catch (err: any) { setError(err?.response?.data?.detail || 'Failed to save education info.'); }
    setSaving(false);
  };

  const uploadAvatar = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post<User>('/auth/me/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(data);
    } catch { /* silent */ }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm_password) { setError('New passwords do not match.'); return; }
    setError(''); setSaving(true);
    try {
      await api.post('/auth/change-password', {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
      showSaved();
    } catch (err: any) { setError(err?.response?.data?.detail || 'Failed to update password.'); }
    setSaving(false);
  };

  const setupTwoFactor = async () => {
    setIsTwoFaLoading(true); setTwoFaError('');
    try {
      const { data } = await api.post('/auth/2fa/setup');
      setTwoFaSetup(data);
    } catch (err: any) { setTwoFaError(err.response?.data?.detail || 'Failed to set up 2FA'); }
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

  const yearOptions = Array.from({ length: 50 }, (_, i) => String(new Date().getFullYear() + 5 - i));

  const SECTIONS: { id: Section; label: string; icon: string; danger?: boolean }[] = [
    { id: 'profile',       label: 'Public profile',     icon: 'person' },
    { id: 'education',     label: 'Education',          icon: 'school' },
    { id: 'account',       label: 'Account & security', icon: 'manage_accounts' },
    { id: 'tokens',        label: 'Developer settings', icon: 'key' },
    { id: 'notifications', label: 'Notifications',      icon: 'notifications' },
    { id: 'danger',        label: 'Danger zone',        icon: 'warning', danger: true },
  ];

  const inp = 'gh-inp';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── scoped styles ─────────────────────────────────────────────────── */}
      <style>{`
        /* root */
        .gh-root { min-height:100vh; background:#0d1117; color:#e6edf3;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif;
          font-size:14px; }

        /* layout */
        .gh-layout { max-width:1012px; margin:0 auto; padding:24px 16px 80px;
          display:grid; grid-template-columns:220px 1fr; gap:24px; align-items:start; }
        @media(max-width:768px){ .gh-layout{grid-template-columns:1fr;} .gh-sidebar{display:flex;flex-wrap:wrap;gap:4px;} }

        /* sidebar */
        .gh-sidebar { position:sticky; top:80px; }
        .gh-sidebar-heading { font-size:12px; font-weight:600; color:#7d8590; text-transform:uppercase;
          letter-spacing:.05em; padding:6px 8px; margin-bottom:4px; }
        .gh-nav-btn { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:6px;
          font-size:13.5px; font-weight:400; color:#cdd9e5; cursor:pointer; transition:background .1s,color .1s;
          width:100%; text-align:left; border:none; background:none; font-family:inherit; }
        .gh-nav-btn:hover { background:#161b22; color:#e6edf3; }
        .gh-nav-btn.active { background:rgba(31,111,235,.13); color:#58a6ff; font-weight:600; }
        .gh-nav-btn.danger { color:#f85149; }
        .gh-nav-btn.danger:hover { background:rgba(248,81,73,.08); }
        .gh-nav-btn.danger.active { background:rgba(248,81,73,.1); color:#f85149; font-weight:600; }
        .gh-nav-btn .material-symbols-outlined { font-size:16px; flex-shrink:0; }
        .gh-nav-divider { height:1px; background:#21262d; margin:8px 0; }

        /* panel */
        .gh-panel { background:#0d1117; border:1px solid #21262d; border-radius:6px; overflow:hidden; }

        /* section */
        .gh-section-header { padding:16px 24px; border-bottom:1px solid #21262d; }
        .gh-section-title { font-size:16px; font-weight:600; color:#e6edf3; margin:0 0 4px; }
        .gh-section-desc { font-size:13px; color:#7d8590; margin:0; }
        .gh-section-body { padding:24px; display:flex; flex-direction:column; gap:18px; }

        /* form */
        .gh-form-group { display:flex; flex-direction:column; gap:6px; }
        .gh-label { font-size:13.5px; font-weight:600; color:#e6edf3; }
        .gh-hint { font-size:12px; color:#7d8590; margin:0; }

        /* inputs */
        .gh-inp { background:#010409; border:1px solid #30363d; border-radius:6px;
          color:#e6edf3; font-size:14px; padding:5px 12px; height:32px; width:100%;
          outline:none; transition:border-color .15s,box-shadow .15s; font-family:inherit; }
        .gh-inp:focus { border-color:#1f6feb; box-shadow:0 0 0 3px rgba(31,111,235,.3); }
        .gh-inp::placeholder { color:#484f58; }
        .gh-textarea { background:#010409; border:1px solid #30363d; border-radius:6px;
          color:#e6edf3; font-size:14px; padding:8px 12px; width:100%; outline:none;
          resize:vertical; font-family:inherit; transition:border-color .15s,box-shadow .15s; }
        .gh-textarea:focus { border-color:#1f6feb; box-shadow:0 0 0 3px rgba(31,111,235,.3); }
        .gh-textarea::placeholder { color:#484f58; }
        .gh-select { background:#21262d; border:1px solid #30363d; border-radius:6px;
          color:#e6edf3; font-size:14px; padding:5px 28px 5px 12px; height:32px; width:100%;
          outline:none; cursor:pointer; font-family:inherit; appearance:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath fill='%237d8590' d='M0 0l5 6 5-6'/%3E%3C/svg%3E");
          background-repeat:no-repeat; background-position:right 10px center; }
        .gh-select:focus { border-color:#1f6feb; box-shadow:0 0 0 3px rgba(31,111,235,.3); }

        /* prefix input */
        .gh-prefix-wrap { position:relative; }
        .gh-prefix { position:absolute; left:12px; top:50%; transform:translateY(-50%);
          color:#7d8590; font-size:14px; pointer-events:none; user-select:none; white-space:nowrap; }

        /* buttons */
        .gh-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px;
          padding:5px 16px; height:32px; font-size:13.5px; font-weight:600; border-radius:6px;
          cursor:pointer; transition:background .15s,border-color .15s; border:1px solid;
          font-family:inherit; white-space:nowrap; outline:none; }
        .gh-btn:disabled { opacity:.6; cursor:not-allowed; }
        .gh-btn-primary { background:#238636; border-color:rgba(240,246,252,.1); color:#fff; }
        .gh-btn-primary:hover:not(:disabled) { background:#2ea043; }
        .gh-btn-default { background:#21262d; border-color:rgba(240,246,252,.1); color:#cdd9e5; }
        .gh-btn-default:hover:not(:disabled) { background:#30363d; }
        .gh-btn-danger { background:#da3633; border-color:rgba(240,246,252,.1); color:#fff; }
        .gh-btn-danger:hover:not(:disabled) { background:#f85149; }
        .gh-btn-outline-danger { background:transparent; border-color:#f85149; color:#f85149; }
        .gh-btn-outline-danger:hover:not(:disabled) { background:rgba(248,81,73,.1); }

        /* form actions */
        .gh-form-actions { display:flex; align-items:center; gap:12px;
          padding-top:16px; border-top:1px solid #21262d; }

        /* form grid */
        .gh-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        @media(max-width:600px){ .gh-grid2{grid-template-columns:1fr;} }

        /* divider */
        .gh-hr { height:1px; background:#21262d; border:none; margin:4px 0; }

        /* avatar */
        .gh-avatar-row { display:flex; align-items:flex-start; gap:20px;
          padding-bottom:20px; border-bottom:1px solid #21262d; }
        .gh-avatar { width:80px; height:80px; border-radius:50%; border:1px solid #30363d;
          overflow:hidden; flex-shrink:0; cursor:pointer; background:#161b22;
          display:flex; align-items:center; justify-content:center;
          font-size:30px; font-weight:700; color:#e6edf3; transition:border-color .15s; }
        .gh-avatar:hover { border-color:#58a6ff; }
        .gh-avatar img { width:100%; height:100%; object-fit:cover; }
        .gh-avatar-name { font-weight:600; font-size:15px; margin-bottom:4px; }
        .gh-avatar-link { color:#58a6ff; font-size:13px; cursor:pointer; font-weight:500; }
        .gh-avatar-link:hover { text-decoration:underline; }
        .gh-avatar-sub { color:#7d8590; font-size:12px; margin-top:4px; }

        /* info row */
        .gh-info-row { display:flex; align-items:center; gap:10px; padding:8px 0;
          border-bottom:1px solid #21262d; color:#7d8590; font-size:13px; }
        .gh-info-row:last-child { border-bottom:none; }
        .gh-info-label { flex:1; }
        .gh-info-value { color:#e6edf3; font-weight:500; }

        /* error */
        .gh-error-banner { display:flex; align-items:center; gap:8px; padding:10px 14px;
          background:rgba(248,81,73,.08); border:1px solid rgba(248,81,73,.4);
          border-radius:6px; color:#f85149; font-size:13px; font-weight:500; }

        /* save ok */
        .gh-save-ok { display:inline-flex; align-items:center; gap:5px;
          color:#3fb950; font-size:13px; font-weight:600;
          animation:ghFadeIn .2s ease; }
        @keyframes ghFadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }

        /* box */
        .gh-box { border:1px solid #21262d; border-radius:6px; overflow:hidden; }
        .gh-box-hdr { background:#161b22; padding:10px 16px; font-weight:600;
          font-size:13px; border-bottom:1px solid #21262d; display:flex; align-items:center; gap:8px; }
        .gh-box-body { padding:16px; display:flex; flex-direction:column; gap:14px; }

        /* scope pills */
        .gh-pill { display:inline-flex; align-items:center; gap:5px; padding:3px 10px;
          border-radius:999px; border:1px solid; font-size:12px; font-weight:600;
          cursor:pointer; transition:all .15s; user-select:none; }
        .gh-pill.on { background:rgba(31,111,235,.1); border-color:#388bfd; color:#58a6ff; }
        .gh-pill.off { background:transparent; border-color:#30363d; color:#7d8590; }
        .gh-pill.off:hover { border-color:#484f58; color:#cdd9e5; }

        /* token created */
        .gh-token-created { display:flex; flex-direction:column; gap:8px; padding:12px;
          background:rgba(63,185,80,.08); border:1px solid rgba(63,185,80,.4);
          border-radius:6px; margin-top:4px; }
        .gh-token-created-lbl { color:#3fb950; font-size:12px; font-weight:600; }
        .gh-token-row { display:flex; align-items:center; gap:8px; }
        .gh-token-code { font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;
          font-size:12px; background:#161b22; border:1px solid #30363d; border-radius:6px;
          padding:6px 10px; flex:1; overflow-x:auto; word-break:break-all; color:#e6edf3; }
        .gh-copy-btn { padding:5px 8px; background:#21262d; border:1px solid #30363d;
          border-radius:6px; color:#cdd9e5; cursor:pointer; display:flex; align-items:center;
          transition:background .15s; flex-shrink:0; }
        .gh-copy-btn:hover { background:#30363d; }

        /* token list item */
        .gh-tok-item { display:flex; align-items:center; justify-content:space-between;
          gap:16px; padding:12px 16px; border-bottom:1px solid #21262d; }
        .gh-tok-item:last-child { border-bottom:none; }
        .gh-tok-name { font-weight:600; font-size:13.5px; }
        .gh-tok-meta { font-size:12px; color:#7d8590; margin-top:2px; }

        /* toggle */
        .gh-toggle-row { display:flex; align-items:center; justify-content:space-between;
          gap:16px; padding:14px 0; border-bottom:1px solid #21262d; }
        .gh-toggle-row:last-child { border-bottom:none; }
        .gh-toggle-lbl { font-size:13.5px; font-weight:600; color:#e6edf3; }
        .gh-toggle-desc { font-size:12px; color:#7d8590; margin-top:2px; }
        .gh-toggle { width:44px; height:24px; border-radius:999px; border:none;
          cursor:pointer; flex-shrink:0; position:relative; transition:background .2s; outline:none; }
        .gh-toggle.on { background:#238636; }
        .gh-toggle.off { background:#30363d; }
        .gh-toggle-thumb { position:absolute; top:3px; width:18px; height:18px;
          border-radius:50%; background:#fff; transition:left .2s; box-shadow:0 1px 3px rgba(0,0,0,.4); }
        .on .gh-toggle-thumb { left:23px; }
        .off .gh-toggle-thumb { left:3px; }

        /* danger box */
        .gh-danger-box { border:1px solid rgba(248,81,73,.35); border-radius:6px; overflow:hidden; }
        .gh-danger-box-hdr { background:rgba(248,81,73,.1); padding:12px 16px;
          font-size:13px; font-weight:600; color:#f85149; border-bottom:1px solid rgba(248,81,73,.2); }
        .gh-danger-item { display:flex; align-items:center; justify-content:space-between;
          gap:16px; padding:16px; border-bottom:1px solid rgba(248,81,73,.15); }
        .gh-danger-item:last-child { border-bottom:none; }
        .gh-danger-ttl { font-weight:600; color:#e6edf3; font-size:13.5px; margin-bottom:2px; }
        .gh-danger-sub { font-size:12px; color:#7d8590; }

        /* 2FA OK badge */
        .gh-2fa-ok { display:flex; align-items:center; gap:6px; color:#3fb950;
          font-size:13px; font-weight:600; padding:6px 0; margin-bottom:12px; }

        /* modal */
        .gh-overlay { position:fixed; inset:0; background:rgba(1,4,9,.8);
          display:flex; align-items:center; justify-content:center; z-index:999; padding:16px; }
        .gh-modal { background:#161b22; border:1px solid #30363d; border-radius:6px;
          padding:24px; max-width:440px; width:100%; box-shadow:0 8px 24px rgba(1,4,9,.5); }
        .gh-modal-title { font-size:16px; font-weight:600; color:#e6edf3; margin:0 0 8px; }
        .gh-modal-body { font-size:13.5px; color:#7d8590; line-height:1.6; margin:0 0 16px; }
        .gh-modal-actions { display:flex; gap:10px; }
        .gh-modal-actions > * { flex:1; height:34px; font-size:13.5px; }
      `}</style>

      <div className="gh-root">
        <Navbar />

        <div
          className="gh-layout"
          style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.3s' }}
        >
          {/* ===== SIDEBAR ===== */}
          <nav className="gh-sidebar">
            <div className="gh-sidebar-heading">User settings</div>

            {SECTIONS.filter((s) => !s.danger).map((s) => (
              <button
                key={s.id}
                onClick={() => { setActiveSection(s.id); setError(''); }}
                className={`gh-nav-btn${activeSection === s.id ? ' active' : ''}`}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: activeSection === s.id ? '"FILL" 1' : '"FILL" 0' }}
                >
                  {s.icon}
                </span>
                {s.label}
              </button>
            ))}

            <div className="gh-nav-divider" />

            {SECTIONS.filter((s) => s.danger).map((s) => (
              <button
                key={s.id}
                onClick={() => { setActiveSection(s.id); setError(''); }}
                className={`gh-nav-btn danger${activeSection === s.id ? ' active' : ''}`}
              >
                <span className="material-symbols-outlined">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>

          {/* ===== CONTENT ===== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ─── PROFILE ─────────────────────────────────────────────────── */}
            {activeSection === 'profile' && (
              <div className="gh-panel">
                <SettingSection
                  title="Public profile"
                  description="Your profile information is visible to everyone."
                >
                  {/* Avatar row */}
                  <div className="gh-avatar-row">
                    <div className="gh-avatar" onClick={() => avatarInputRef.current?.click()} title="Upload avatar">
                      {user?.avatar_url
                        ? <img src={user.avatar_url} alt="" />
                        : <span>{user?.username?.charAt(0).toUpperCase()}</span>
                      }
                    </div>
                    <div>
                      <div className="gh-avatar-name">{user?.username}</div>
                      <span
                        className="gh-avatar-link"
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        Upload a photo...
                      </span>
                      <div className="gh-avatar-sub">JPG, PNG, GIF or WEBP &middot; Max 5&nbsp;MB</div>
                    </div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { if (e.target.files?.[0]) uploadAvatar(e.target.files[0]); }}
                    />
                  </div>

                  <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Username */}
                    <FormGroup
                      label="Username"
                      htmlFor="set-username"
                      hint="Changing your username will break existing clone URLs."
                    >
                      <div className="gh-prefix-wrap">
                        <span className="gh-prefix">pandahub.dev/</span>
                        <input
                          id="set-username"
                          type="text"
                          value={profile.username}
                          onChange={(e) => setProfile({ ...profile, username: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                          className={inp}
                          style={{ paddingLeft: '120px' }}
                        />
                      </div>
                    </FormGroup>

                    {/* Name */}
                    <div className="gh-grid2">
                      <FormGroup label="First name" htmlFor="set-firstname">
                        <input id="set-firstname" type="text" value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} placeholder="Ada" className={inp} />
                      </FormGroup>
                      <FormGroup label="Last name" htmlFor="set-lastname">
                        <input id="set-lastname" type="text" value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} placeholder="Lovelace" className={inp} />
                      </FormGroup>
                    </div>

                    {/* Bio */}
                    <FormGroup label="Bio" htmlFor="set-bio">
                      <textarea
                        id="set-bio"
                        rows={4}
                        value={profile.bio}
                        onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                        placeholder="Tell us a little bit about yourself"
                        className="gh-textarea"
                        maxLength={500}
                      />
                      <p className="gh-hint" style={{ textAlign: 'right' }}>{profile.bio.length}/500</p>
                    </FormGroup>

                    {/* Website + Location */}
                    <div className="gh-grid2">
                      <FormGroup label="Website" htmlFor="set-website">
                        <input id="set-website" type="url" value={profile.website_url} onChange={(e) => setProfile({ ...profile, website_url: e.target.value })} placeholder="https://" className={inp} />
                      </FormGroup>
                      <FormGroup label="Location" htmlFor="set-location">
                        <input id="set-location" type="text" value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} placeholder="City, Country" className={inp} />
                      </FormGroup>
                    </div>

                    {error && <ErrorBanner msg={error} />}
                    <div className="gh-form-actions">
                      <button type="submit" disabled={saving} id="save-profile-btn" className="gh-btn gh-btn-primary">
                        {saving ? 'Saving...' : 'Update profile'}
                      </button>
                      {saved && <SaveSuccess />}
                    </div>
                  </form>
                </SettingSection>
              </div>
            )}

            {/* ─── EDUCATION ───────────────────────────────────────────────── */}
            {activeSection === 'education' && (
              <div className="gh-panel">
                <SettingSection
                  title="Education"
                  description="Your academic background — shown on your public profile."
                >
                  <form onSubmit={saveEducation} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <FormGroup label="Institution / University" htmlFor="set-institution">
                      <input
                        id="set-institution"
                        type="text"
                        value={education.institution}
                        onChange={(e) => setEducation({ ...education, institution: e.target.value })}
                        placeholder="e.g. IIT Bombay, Stanford University"
                        className={inp}
                      />
                    </FormGroup>

                    <div className="gh-grid2">
                      <FormGroup label="Degree" htmlFor="set-degree">
                        <select id="set-degree" value={education.degree} onChange={(e) => setEducation({ ...education, degree: e.target.value })} className="gh-select">
                          <option value="">Select degree...</option>
                          {DEGREES.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </FormGroup>
                      <FormGroup label="Graduation year" htmlFor="set-grad-year">
                        <select id="set-grad-year" value={education.graduation_year} onChange={(e) => setEducation({ ...education, graduation_year: e.target.value })} className="gh-select">
                          <option value="">Select year...</option>
                          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </FormGroup>
                    </div>

                    <FormGroup label="Field of study" htmlFor="set-field">
                      <input
                        id="set-field"
                        type="text"
                        value={education.field_of_study}
                        onChange={(e) => setEducation({ ...education, field_of_study: e.target.value })}
                        placeholder="e.g. Computer Science, Data Science"
                        className={inp}
                      />
                    </FormGroup>

                    {error && <ErrorBanner msg={error} />}
                    <div className="gh-form-actions">
                      <button type="submit" disabled={saving} id="save-education-btn" className="gh-btn gh-btn-primary">
                        {saving ? 'Saving...' : 'Save education'}
                      </button>
                      {saved && <SaveSuccess />}
                    </div>
                  </form>
                </SettingSection>
              </div>
            )}

            {/* ─── ACCOUNT & SECURITY ──────────────────────────────────────── */}
            {activeSection === 'account' && (
              <>
                {/* Account info */}
                <div className="gh-panel">
                  <SettingSection title="Account" description="Your account details.">
                    <InfoRow label="Email address" value={user?.email || '—'} icon="mail" />
                    <InfoRow
                      label="Member since"
                      value={user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                      icon="calendar_today"
                    />
                    <InfoRow label="Email verified" value={user?.is_verified ? 'Verified ✓' : 'Not verified — check your inbox'} icon="verified_user" />
                  </SettingSection>
                </div>

                {/* Change password */}
                <div className="gh-panel">
                  <SettingSection title="Change password" description="We will ask for this password whenever you sign in.">
                    <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {[
                        { key: 'current_password', label: 'Current password',     placeholder: 'Your current password',  id: 'pwd-cur' },
                        { key: 'new_password',      label: 'New password',         placeholder: 'Minimum 8 characters',   id: 'pwd-new' },
                        { key: 'confirm_password',  label: 'Confirm new password', placeholder: 'Repeat new password',    id: 'pwd-cfm' },
                      ].map((f) => (
                        <FormGroup key={f.key} label={f.label} htmlFor={f.id}>
                          <input
                            id={f.id}
                            type="password"
                            value={passwords[f.key as keyof typeof passwords]}
                            onChange={(e) => setPasswords({ ...passwords, [f.key]: e.target.value })}
                            placeholder={f.placeholder}
                            required
                            className={inp}
                          />
                        </FormGroup>
                      ))}
                      {error && <ErrorBanner msg={error} />}
                      <div className="gh-form-actions">
                        <button type="submit" disabled={saving} className="gh-btn gh-btn-primary">
                          {saving ? 'Updating...' : 'Update password'}
                        </button>
                        {saved && <SaveSuccess />}
                      </div>
                    </form>
                  </SettingSection>
                </div>

                {/* 2FA */}
                <div className="gh-panel">
                  <SettingSection
                    title="Two-factor authentication"
                    description="Add an extra layer of security to your account by requiring more than just a password to sign in."
                  >
                    {user?.two_factor_enabled ? (
                      <div>
                        <div className="gh-2fa-ok">
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                          </svg>
                          Two-factor authentication is enabled
                        </div>
                        <p className="gh-hint" style={{ marginBottom: 14 }}>
                          To disable 2FA, enter your current password and a code from your authenticator app.
                        </p>
                        <form onSubmit={disableTwoFactor} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {twoFaError && <ErrorBanner msg={twoFaError} />}
                          <FormGroup label="Confirm password" htmlFor="2fa-dis-pwd">
                            <input id="2fa-dis-pwd" type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} placeholder="Your current password" required className={inp} />
                          </FormGroup>
                          <FormGroup label="Authentication code" htmlFor="2fa-dis-code">
                            <input id="2fa-dis-code" type="text" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" required className={inp} style={{ fontFamily: 'monospace', letterSpacing: '0.15em', maxWidth: 180 }} maxLength={6} />
                          </FormGroup>
                          <div>
                            <button type="submit" disabled={isTwoFaLoading || totpCode.length !== 6 || !disablePassword} className="gh-btn gh-btn-outline-danger">
                              {isTwoFaLoading ? 'Disabling...' : 'Disable two-factor authentication'}
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : twoFaSetup ? (
                      <form onSubmit={enableTwoFactor} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <p className="gh-hint">
                          Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy), then enter the 6-digit code below to verify.
                        </p>
                        <div style={{ padding: 16, background: '#fff', borderRadius: 8, display: 'inline-block', border: '1px solid #30363d' }}>
                          <QRCodeSVG value={twoFaSetup.provisioning_uri} size={148} />
                        </div>
                        {twoFaError && <ErrorBanner msg={twoFaError} />}
                        <FormGroup label="Verify the code from the app" htmlFor="2fa-en-code">
                          <input id="2fa-en-code" type="text" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="XXXXXX" required className={inp} style={{ fontFamily: 'monospace', letterSpacing: '0.2em', maxWidth: 160 }} maxLength={6} />
                        </FormGroup>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button type="submit" disabled={isTwoFaLoading || totpCode.length !== 6} className="gh-btn gh-btn-primary">
                            {isTwoFaLoading ? 'Enabling...' : 'Enable two-factor authentication'}
                          </button>
                          <button type="button" onClick={() => { setTwoFaSetup(null); setTotpCode(''); setTwoFaError(''); }} className="gh-btn gh-btn-default">
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div>
                        <p className="gh-hint" style={{ marginBottom: 14 }}>
                          Protect your account with an authenticator app. You&apos;ll be prompted for a code each time you sign in.
                        </p>
                        <button onClick={setupTwoFactor} disabled={isTwoFaLoading} className="gh-btn gh-btn-default">
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>security</span>
                          {isTwoFaLoading ? 'Loading...' : 'Set up two-factor authentication'}
                        </button>
                      </div>
                    )}
                  </SettingSection>
                </div>
              </>
            )}

            {/* ─── DEVELOPER SETTINGS ──────────────────────────────────────── */}
            {activeSection === 'tokens' && (
              <>
                {/* Generate token */}
                <div className="gh-panel">
                  <SettingSection
                    title="Personal access tokens"
                    description="Use tokens to authenticate with the panda CLI or Git over HTTPS. Tokens work like passwords — keep them secret."
                  >
                    <div className="gh-box">
                      <div className="gh-box-hdr">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="#3fb950">
                          <path d="M3.5 11.75a.25.25 0 0 1 .25-.25h7.5a.25.25 0 0 1 .25.25v2.5a.25.25 0 0 1-.25.25h-7.5a.25.25 0 0 1-.25-.25Zm.25-1.75a1.75 1.75 0 0 0-1.75 1.75v2.5c0 .966.784 1.75 1.75 1.75h7.5a1.75 1.75 0 0 0 1.75-1.75v-2.5A1.75 1.75 0 0 0 11.25 10H10V7.25a2.25 2.25 0 1 0-4.5 0V10Zm4.5-3.75V10h-1.5V6.25a.75.75 0 0 1 1.5 0Z" />
                        </svg>
                        Generate new token
                      </div>
                      <div className="gh-box-body">
                        <form onSubmit={createToken} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <FormGroup label="Token name" htmlFor="token-name" hint="What is this token for?">
                            <input id="token-name" type="text" value={newTokenName} onChange={(e) => setNewTokenName(e.target.value)} placeholder="e.g. laptop-dev, ci-pipeline" required className={inp} />
                          </FormGroup>

                          <FormGroup label="Expiration" htmlFor="token-expires">
                            <select id="token-expires" value={newTokenDays} onChange={(e) => setNewTokenDays(e.target.value)} className="gh-select" style={{ maxWidth: 220 }}>
                              <option value="7">7 days</option>
                              <option value="30">30 days</option>
                              <option value="90">90 days</option>
                              <option value="365">1 year</option>
                              <option value="">No expiration</option>
                            </select>
                          </FormGroup>

                          <FormGroup label="Scopes">
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {['repo:read', 'repo:write', 'repo:admin', 'user:read'].map((scope) => (
                                <label
                                  key={scope}
                                  className={`gh-pill ${newTokenScopes.includes(scope) ? 'on' : 'off'}`}
                                >
                                  <input
                                    type="checkbox"
                                    style={{ display: 'none' }}
                                    checked={newTokenScopes.includes(scope)}
                                    onChange={(e) =>
                                      setNewTokenScopes(
                                        e.target.checked
                                          ? [...newTokenScopes, scope]
                                          : newTokenScopes.filter((s) => s !== scope),
                                      )
                                    }
                                  />
                                  {scope}
                                </label>
                              ))}
                            </div>
                          </FormGroup>

                          {tokenError && <ErrorBanner msg={tokenError} />}

                          <div>
                            <button type="submit" disabled={tokenLoading || !newTokenName || newTokenScopes.length === 0} className="gh-btn gh-btn-primary">
                              {tokenLoading ? 'Generating...' : 'Generate token'}
                            </button>
                          </div>
                        </form>

                        {createdToken && (
                          <div className="gh-token-created">
                            <div className="gh-token-created-lbl">
                              Make sure to copy your personal access token now. You won&apos;t be able to see it again.
                            </div>
                            <div className="gh-token-row">
                              <code className="gh-token-code">{createdToken}</code>
                              <button className="gh-copy-btn" title="Copy to clipboard" onClick={() => navigator.clipboard.writeText(createdToken)}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </SettingSection>
                </div>

                {/* Active tokens */}
                <div className="gh-panel">
                  <SettingSection title={`Active tokens (${tokens.length})`} description="Your existing personal access tokens.">
                    {tokens.length === 0 ? (
                      <p className="gh-hint">No personal access tokens yet.</p>
                    ) : (
                      <div className="gh-box">
                        {tokens.map((t) => (
                          <div key={t.id} className="gh-tok-item">
                            <div>
                              <div className="gh-tok-name">{t.name}</div>
                              <div className="gh-tok-meta">
                                {t.scopes.join(', ')} &middot;{' '}
                                {t.expires_at
                                  ? `Expires ${new Date(t.expires_at).toLocaleDateString()}`
                                  : 'Never expires'}
                              </div>
                            </div>
                            <button onClick={() => revokeToken(t.id)} className="gh-btn gh-btn-outline-danger" style={{ height: 28, padding: '0 12px', fontSize: 12 }}>
                              Revoke
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </SettingSection>
                </div>
              </>
            )}

            {/* ─── NOTIFICATIONS ───────────────────────────────────────────── */}
            {activeSection === 'notifications' && (
              <div className="gh-panel">
                <SettingSection
                  title="Notifications"
                  description="Choose what you are notified about. Preferences are saved locally in your browser."
                >
                  <div>
                    {([
                      { key: 'commits'    as NotifKey, label: 'Push commits',          detail: 'When someone pushes to a repository you own or watch' },
                      { key: 'issues'     as NotifKey, label: 'New issues',            detail: 'When someone opens a new issue in your repository' },
                      { key: 'pr_reviews' as NotifKey, label: 'Pull request reviews', detail: 'Review requests and approvals on your pull requests' },
                      { key: 'pr_merges'  as NotifKey, label: 'Pull request merges',  detail: 'When a pull request is merged or closed' },
                      { key: 'mentions'   as NotifKey, label: 'Mentions',             detail: 'When someone @mentions you in a comment or review' },
                      { key: 'stars'      as NotifKey, label: 'Stars',                detail: 'When someone stars one of your repositories' },
                      { key: 'followers'  as NotifKey, label: 'New followers',        detail: 'When someone starts following your profile' },
                    ] as { key: NotifKey; label: string; detail: string }[]).map((item) => {
                      const on = notifPrefs[item.key];
                      return (
                        <div key={item.key} className="gh-toggle-row">
                          <div>
                            <div className="gh-toggle-lbl">{item.label}</div>
                            <div className="gh-toggle-desc">{item.detail}</div>
                          </div>
                          <button
                            id={`notif-toggle-${item.key}`}
                            role="switch"
                            aria-checked={on}
                            className={`gh-toggle ${on ? 'on' : 'off'}`}
                            onClick={() => {
                              const next = { ...notifPrefs, [item.key]: !on };
                              setNotifPrefs(next);
                              localStorage.setItem('pandahub_notif_prefs', JSON.stringify(next));
                            }}
                          >
                            <div className="gh-toggle-thumb" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </SettingSection>
              </div>
            )}

            {/* ─── DANGER ZONE ─────────────────────────────────────────────── */}
            {activeSection === 'danger' && (
              <div className="gh-panel">
                <SettingSection
                  title="Danger zone"
                  description="These actions are permanent and cannot be undone."
                >
                  <div className="gh-danger-box">
                    <div className="gh-danger-box-hdr">Irreversible and destructive actions</div>
                    <div className="gh-danger-item">
                      <div>
                        <div className="gh-danger-ttl">Delete this account</div>
                        <div className="gh-danger-sub">
                          Once you delete your account, there is no going back. All your repositories and data will be permanently deleted.
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="gh-btn gh-btn-outline-danger"
                        style={{ flexShrink: 0 }}
                      >
                        Delete account
                      </button>
                    </div>
                  </div>
                </SettingSection>
              </div>
            )}

          </div>{/* /content */}
        </div>{/* /layout */}

        {/* ─── DELETE CONFIRMATION MODAL ───────────────────────────────────── */}
        {showDeleteModal && (
          <div className="gh-overlay">
            <div className="gh-modal">
              <h3 className="gh-modal-title">Are you absolutely sure?</h3>
              <p className="gh-modal-body">
                This action <strong style={{ color: '#e6edf3' }}>cannot be undone</strong>. This will permanently delete your account,
                all your repositories, issues, pull requests, and all associated data.
                <br /><br />
                Please type <strong style={{ color: '#e6edf3' }}>{user?.username}</strong> to confirm.
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={user?.username}
                className={inp}
                style={{ marginBottom: 16 }}
              />
              <div className="gh-modal-actions">
                <button onClick={() => setShowDeleteModal(false)} className="gh-btn gh-btn-default">
                  Cancel
                </button>
                <button
                  disabled={deleteConfirm !== user?.username}
                  onClick={() => { clearAuth(); router.push('/'); }}
                  className="gh-btn gh-btn-danger"
                >
                  Delete this account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>{/* /gh-root */}
    </>
  );
}