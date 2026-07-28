"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

// ─── Step types ───────────────────────────────────────────────────────────────
type Step = 0 | 1 | 2;

const TOTAL_STEPS = 3;

const features = [
  {
    icon: "folder_open",
    color: "text-blue-400",
    bg: "from-blue-500/20 to-blue-600/5",
    title: "Git Repositories",
    desc: "Host unlimited public & private repositories with full git support — clone, push, branch, and merge just like GitHub.",
  },
  {
    icon: "rocket_launch",
    color: "text-violet-400",
    bg: "from-violet-500/20 to-violet-600/5",
    title: "Startup Showcase",
    desc: "Discover and showcase student & indie startups. Connect with founders, explore ideas, and get inspired by what's being built.",
  },
  {
    icon: "bug_report",
    color: "text-amber-400",
    bg: "from-amber-500/20 to-amber-600/5",
    title: "Issues & Pull Requests",
    desc: "Built-in issue tracking and code review with pull requests. Collaborate with your team on every line of code.",
  },
  {
    icon: "group",
    color: "text-emerald-400",
    bg: "from-emerald-500/20 to-emerald-600/5",
    title: "Organizations",
    desc: "Create orgs for your team or university club, manage members, and keep all your shared repositories in one place.",
  },
  {
    icon: "terminal",
    color: "text-cyan-400",
    bg: "from-cyan-500/20 to-cyan-600/5",
    title: "Panda CLI",
    desc: "Use the `panda` command-line tool to authenticate, clone repos, and manage your projects — all from your terminal.",
  },
  {
    icon: "explore",
    color: "text-pink-400",
    bg: "from-pink-500/20 to-pink-600/5",
    title: "Explore & Discover",
    desc: "Find interesting open-source projects, trending repositories, and connect with a community of builders and developers.",
  },
];

const DEGREES = [
  "High School",
  "Associate's",
  "Bachelor's",
  "Master's",
  "PhD / Doctorate",
  "Bootcamp",
  "Self-taught",
  "Other",
];

// ─── Onboarding page ─────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const { user, fetchMe } = useAuthStore();

  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [institution, setInstitution] = useState("");
  const [degree, setDegree] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [graduationYear, setGraduationYear] = useState("");

  // Pre-fill from existing user data
  useEffect(() => {
    if (user) {
      const parts = (user.full_name || "").split(" ");
      setFirstName((user as any).first_name || parts[0] || "");
      setLastName((user as any).last_name || parts.slice(1).join(" ") || "");
      setUsername(user.username || "");
      setInstitution((user as any).institution || "");
      setDegree((user as any).degree || "");
      setFieldOfStudy((user as any).field_of_study || "");
      setGraduationYear(String((user as any).graduation_year || ""));
    }
  }, [user]);

  const saveAndContinue = async () => {
    setError("");
    setSaving(true);
    try {
      await api.patch("/auth/me", {
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        username: username || undefined,
        full_name: `${firstName} ${lastName}`.trim() || undefined,
        institution: institution || undefined,
        degree: degree || undefined,
        field_of_study: fieldOfStudy || undefined,
        graduation_year: graduationYear ? Number(graduationYear) : undefined,
        needs_onboarding: step === TOTAL_STEPS - 1 ? false : undefined,
      });
      await fetchMe();
      if (step < TOTAL_STEPS - 1) {
        setStep((s) => (s + 1) as Step);
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    setError("");
    setSaving(true);
    try {
      await api.patch("/auth/me", { needs_onboarding: false });
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    }
  };

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  const yearOptions = Array.from({ length: 50 }, (_, i) => String(new Date().getFullYear() + 5 - i));

  return (
    <main className="min-h-screen bg-background text-on-surface font-body overflow-hidden relative">
      {/* Ambient orbs */}
      <div className="fixed top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full bg-primary/8 blur-[140px] pointer-events-none animate-pulse" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[45%] h-[45%] rounded-full bg-secondary/10 blur-[120px] pointer-events-none" />
      <div className="fixed top-[40%] right-[15%] w-[25%] h-[25%] rounded-full bg-tertiary/5 blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Logo / Brand */}
        <div className="mb-8 flex flex-col items-center gap-2 animate-fade-in-up">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_0_30px_rgba(10,132,255,0.4)]">
            <span className="text-2xl">🐼</span>
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            PandaHub
          </span>
        </div>

        {/* Card */}
        <div className="w-full max-w-2xl animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-medium text-on-surface-variant mb-2">
              <span>Step {step + 1} of {TOTAL_STEPS}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="glass-panel card-glow rounded-3xl p-8 sm:p-10 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.15)] relative overflow-hidden">
            {/* Gradient top bar */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-secondary to-primary opacity-70" />

            {/* ── STEP 0: Personal Info ── */}
            {step === 0 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight mb-2">
                    Welcome to <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">PandaHub</span> 👋
                  </h1>
                  <p className="text-on-surface-variant text-sm font-medium">
                    Let&apos;s start with the basics. You can always change these later in Settings.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-on-surface" htmlFor="first-name">
                      First name
                    </label>
                    <input
                      id="first-name"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Ada"
                      className="block w-full px-4 py-3 bg-surface-container-low/50 input-glass border-outline-variant/30 rounded-xl text-on-surface placeholder:text-outline focus:ring-0 text-sm font-medium glow-accent-focus"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-on-surface" htmlFor="last-name">
                      Last name
                    </label>
                    <input
                      id="last-name"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Lovelace"
                      className="block w-full px-4 py-3 bg-surface-container-low/50 input-glass border-outline-variant/30 rounded-xl text-on-surface placeholder:text-outline focus:ring-0 text-sm font-medium glow-accent-focus"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-on-surface" htmlFor="username">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-semibold text-sm select-none">
                      pandahub.dev/
                    </span>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
                      placeholder="your-username"
                      className="block w-full pl-[8.5rem] pr-4 py-3 bg-surface-container-low/50 input-glass border-outline-variant/30 rounded-xl text-on-surface placeholder:text-outline focus:ring-0 text-sm font-medium glow-accent-focus"
                    />
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    Only lowercase letters, numbers, hyphens, and underscores.
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-error/10 border border-error/30 rounded-xl text-error text-sm font-medium flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    {error}
                  </div>
                )}

                <button
                  id="onboarding-next-0"
                  onClick={saveAndContinue}
                  disabled={saving || !firstName || !username}
                  className="btn-primary btn-ripple w-full flex justify-center items-center gap-2 py-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_20px_rgba(10,132,255,0.3)]"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving…
                    </>
                  ) : (
                    <>
                      Continue
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* ── STEP 1: Education ── */}
            {step === 1 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight mb-2">
                    Your Education 🎓
                  </h1>
                  <p className="text-on-surface-variant text-sm font-medium">
                    Help us tailor PandaHub for you. All fields are optional and visible only on your profile.
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-on-surface" htmlFor="institution">
                      Institution / University
                    </label>
                    <input
                      id="institution"
                      type="text"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="e.g. IIT Bombay, Stanford University"
                      className="block w-full px-4 py-3 bg-surface-container-low/50 input-glass border-outline-variant/30 rounded-xl text-on-surface placeholder:text-outline focus:ring-0 text-sm font-medium glow-accent-focus"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-on-surface" htmlFor="degree">
                        Degree
                      </label>
                      <select
                        id="degree"
                        value={degree}
                        onChange={(e) => setDegree(e.target.value)}
                        className="block w-full px-4 py-3 bg-surface-container-low/50 input-glass border-outline-variant/30 rounded-xl text-on-surface focus:ring-0 text-sm font-medium glow-accent-focus appearance-none cursor-pointer"
                      >
                        <option value="">Select degree…</option>
                        {DEGREES.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-on-surface" htmlFor="graduation-year">
                        Graduation Year
                      </label>
                      <select
                        id="graduation-year"
                        value={graduationYear}
                        onChange={(e) => setGraduationYear(e.target.value)}
                        className="block w-full px-4 py-3 bg-surface-container-low/50 input-glass border-outline-variant/30 rounded-xl text-on-surface focus:ring-0 text-sm font-medium glow-accent-focus appearance-none cursor-pointer"
                      >
                        <option value="">Select year…</option>
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-on-surface" htmlFor="field-of-study">
                      Field of Study
                    </label>
                    <input
                      id="field-of-study"
                      type="text"
                      value={fieldOfStudy}
                      onChange={(e) => setFieldOfStudy(e.target.value)}
                      placeholder="e.g. Computer Science, Data Science, MBA"
                      className="block w-full px-4 py-3 bg-surface-container-low/50 input-glass border-outline-variant/30 rounded-xl text-on-surface placeholder:text-outline focus:ring-0 text-sm font-medium glow-accent-focus"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-error/10 border border-error/30 rounded-xl text-error text-sm font-medium flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    id="onboarding-back-1"
                    onClick={() => setStep(0)}
                    className="flex-1 py-4 px-4 rounded-2xl border border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:border-outline-variant text-sm font-semibold transition-all"
                  >
                    ← Back
                  </button>
                  <button
                    id="onboarding-next-1"
                    onClick={saveAndContinue}
                    disabled={saving}
                    className="flex-[2] btn-primary btn-ripple flex justify-center items-center gap-2 py-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_20px_rgba(10,132,255,0.3)]"
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Saving…
                      </>
                    ) : (
                      <>
                        Continue
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Feature Tour ── */}
            {step === 2 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight mb-2">
                    You&apos;re all set! 🚀
                  </h1>
                  <p className="text-on-surface-variant text-sm font-medium">
                    Here&apos;s everything you can do on PandaHub. Explore freely — you&apos;re home.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {features.map((f, i) => (
                    <div
                      key={f.title}
                      className={`group relative p-5 rounded-2xl bg-gradient-to-br ${f.bg} border border-white/5 hover:border-white/15 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-default`}
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`material-symbols-outlined text-[22px] mt-0.5 shrink-0 ${f.color}`}
                          style={{ fontVariationSettings: '"FILL" 1' }}
                        >
                          {f.icon}
                        </span>
                        <div>
                          <div className="font-bold text-sm text-on-surface mb-1">{f.title}</div>
                          <div className="text-xs text-on-surface-variant leading-relaxed">{f.desc}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3">
                  <span className="material-symbols-outlined text-[20px] text-primary mt-0.5 shrink-0" style={{ fontVariationSettings: '"FILL" 1' }}>
                    lightbulb
                  </span>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    <span className="text-on-surface font-semibold">Pro tip:</span> Start by creating your first repository — click <strong>+ New</strong> in the dashboard, or use the <code className="bg-surface-container px-1.5 py-0.5 rounded text-primary text-xs">panda</code> CLI to push an existing project.
                  </p>
                </div>

                <button
                  id="onboarding-finish"
                  onClick={handleFinish}
                  disabled={saving}
                  className="btn-primary btn-ripple w-full flex justify-center items-center gap-2 py-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_25px_rgba(10,132,255,0.35)]"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                        dashboard
                      </span>
                      Go to Dashboard
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Skip link */}
          {step < 2 && (
            <div className="mt-4 text-center">
              <button
                onClick={handleFinish}
                className="text-xs text-on-surface-variant hover:text-on-surface underline underline-offset-2 transition-colors"
              >
                Skip for now — go to dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
