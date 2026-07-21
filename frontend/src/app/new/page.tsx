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
    <main className="min-h-screen text-on-surface bg-background font-body transition-colors duration-300 relative">
      {/* Background Orbs */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary-container/5 blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary-container/10 blur-[100px] pointer-events-none"></div>

      {/* Header */}
      <header className="bg-surface/80 backdrop-blur-2xl w-full h-16 sticky top-0 z-50 border-b border-outline-variant/20 shadow-sm flex items-center px-6 gap-3">
        <Link href="/dashboard" className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors font-medium text-sm">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Dashboard
        </Link>
        <span className="text-on-surface-variant/50">/</span>
        <span className="font-semibold text-sm">Create a new repository</span>
      </header>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-6 py-12 animate-fade-in-up">
        <div className="glass-panel card-glow rounded-3xl p-8 sm:p-12 shadow-[0_8px_40px_rgb(0,0,0,0.06)] border border-white/20 relative overflow-hidden">
          {/* Subtle top highlight */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-secondary opacity-80" />
          
          <div className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
              <span className="text-4xl">📦</span> New repository
            </h1>
            <p className="text-on-surface-variant text-sm font-medium">
              A repository contains all your project&apos;s files and revision history.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8 stagger-children">
            
            {/* Owner + Name */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-on-surface">Repository name <span className="text-error">*</span></label>
              <div className="flex items-center gap-3">
                <div className="px-4 py-3 bg-surface-container-low/50 input-glass border-outline-variant/30 rounded-xl text-on-surface-variant font-semibold text-sm shrink-0 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  {user?.username || 'user'}
                </div>
                <span className="text-xl font-light text-on-surface-variant/50">/</span>
                <input
                  id="new-repo-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="my-awesome-project"
                  className="block w-full px-4 py-3 bg-surface-container-low/50 input-glass border-outline-variant/30 rounded-xl text-on-surface placeholder:text-outline focus:ring-0 text-sm font-medium glow-accent-focus"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-on-surface">
                Description <span className="font-normal text-on-surface-variant ml-1">(optional)</span>
              </label>
              <input
                id="new-repo-desc"
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="A short description of your project"
                className="block w-full px-4 py-3 bg-surface-container-low/50 input-glass border-outline-variant/30 rounded-xl text-on-surface placeholder:text-outline focus:ring-0 text-sm font-medium glow-accent-focus"
              />
            </div>

            <hr className="border-outline-variant/20" />

            {/* Visibility */}
            <div className="space-y-4">
              <label className="block text-sm font-bold text-on-surface">Visibility</label>
              <div className="grid gap-3">
                {[
                  { value: 'public', icon: 'public', color: 'text-blue-500', title: 'Public', desc: 'Anyone on the internet can see this repository.' },
                  { value: 'private', icon: 'lock', color: 'text-amber-500', title: 'Private', desc: 'You choose who can see and commit to this repository.' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`relative flex items-start gap-4 p-5 rounded-2xl cursor-pointer transition-all duration-300 border ${
                      form.visibility === opt.value 
                        ? 'bg-primary/5 border-primary shadow-[0_0_20px_rgba(10,132,255,0.15)] scale-[1.01]' 
                        : 'bg-surface-container-low/30 border-outline-variant/30 hover:bg-surface-container-low/60 hover:border-outline-variant/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={opt.value}
                      checked={form.visibility === opt.value}
                      onChange={() => setForm({ ...form, visibility: opt.value as 'public' | 'private' })}
                      className="peer sr-only"
                    />
                    <div className={`mt-0.5 flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all ${
                      form.visibility === opt.value ? 'border-primary' : 'border-outline-variant'
                    }`}>
                      <div className={`w-2.5 h-2.5 rounded-full bg-primary transition-all scale-0 ${
                        form.visibility === opt.value ? 'scale-100' : ''
                      }`} />
                    </div>
                    
                    <span className={`material-symbols-outlined mt-0.5 ${opt.color}`} style={{ fontVariationSettings: '"FILL" 1' }}>{opt.icon}</span>
                    <div className="flex-1">
                      <div className={`font-bold text-sm mb-1 transition-colors ${form.visibility === opt.value ? 'text-primary' : 'text-on-surface'}`}>
                        {opt.title}
                      </div>
                      <div className="text-xs text-on-surface-variant font-medium leading-relaxed">
                        {opt.desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <hr className="border-outline-variant/20" />

            {/* Initialize repo */}
            <label className="flex items-start gap-3 p-4 rounded-xl bg-surface-container-low/30 border border-outline-variant/20 cursor-pointer hover:bg-surface-container-low/50 transition-colors">
              <input
                type="checkbox"
                checked={form.auto_init}
                onChange={(e) => setForm({ ...form, auto_init: e.target.checked })}
                className="mt-1 w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary focus:ring-offset-0 bg-transparent transition-all"
              />
              <div>
                <div className="font-bold text-sm text-on-surface">Initialize this repository with a README</div>
                <div className="text-xs text-on-surface-variant font-medium mt-1">
                  This will allow you to immediately clone the repository to your computer.
                </div>
              </div>
            </label>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-error/10 border border-error/30 rounded-xl text-error text-sm text-center animate-bounce-in flex items-center gap-2 justify-center font-medium">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {error}
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4">
              <button
                id="create-repo-submit"
                type="submit"
                disabled={loading || !form.name}
                className="btn-primary btn-ripple w-full flex justify-center items-center gap-2 py-4 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_20px_rgba(10,132,255,0.3)] hover:shadow-[0_12px_25px_rgba(10,132,255,0.4)] transition-all"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Creating repository…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">add_box</span>
                    Create repository
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </main>
  );
}
