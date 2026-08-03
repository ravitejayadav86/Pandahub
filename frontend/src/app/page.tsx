"use client";
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Settings from './Settings';

/* ═══════════════════════════════════════════════════════
   3D TILT CARD — Spatial UI
═══════════════════════════════════════════════════════ */
function TiltCard({ children, className, style }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    setRotate({
      x: -(mouseY / (rect.height / 2)) * 12,
      y:  (mouseX / (rect.width  / 2)) * 12,
    });
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setRotate({ x: 0, y: 0 })}
      style={{
        transform: `perspective(1100px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
        transformStyle: 'preserve-3d',
        transition: 'transform 0.18s ease-out',
        ...style,
      }}
      className={className}
    >
      <div style={{ transform: 'translateZ(32px)', transformStyle: 'preserve-3d' }}>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SCROLL REVEAL
═══════════════════════════════════════════════════════ */
function RevealOnScroll({ children, className = '', delay = 0 }: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e?.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.08, rootMargin: '-40px' }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        visible
          ? 'opacity-100 translate-y-0 scale-100 blur-0'
          : 'opacity-0 translate-y-8 scale-[0.97] blur-[2px]'
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SKEUOMORPHIC MACINTOSH WINDOW
═══════════════════════════════════════════════════════ */
function SkeuWindow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #1c2232 0%, #141824 100%)',
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.14),
          inset 0 -1px 0 rgba(0,0,0,0.4),
          inset 1px 0 0 rgba(255,255,255,0.06),
          0 32px 80px rgba(0,0,0,0.45),
          0 12px 32px rgba(0,0,0,0.35),
          0 4px 10px rgba(0,0,0,0.3)
        `,
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Titlebar — skeuomorphic metal */}
      <div
        className="flex items-center px-4 py-3 gap-3 relative overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #2d3348 0%, #1e2438 50%, #181e2e 100%)',
          borderBottom: '1px solid rgba(0,0,0,0.5)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
        }}
      >
        {/* Sheen stripe */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)',
          }}
        />
        {/* Traffic lights — skeuomorphic spheres */}
        {[
          { color: '#FF5F57', glow: '#ff3d33', shadow: '#c0392b' },
          { color: '#FEBC2E', glow: '#f0a800', shadow: '#c88c00' },
          { color: '#28C840', glow: '#18b030', shadow: '#128020' },
        ].map(({ color, glow, shadow }) => (
          <div
            key={color}
            className="w-3 h-3 rounded-full relative flex-shrink-0"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${glow} 0%, ${color} 50%, ${shadow} 100%)`,
              boxShadow: `0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.4), 0 0 6px ${color}55`,
            }}
          />
        ))}
        {/* Address bar */}
        <div
          className="flex-grow flex justify-center"
        >
          <div
            className="px-5 py-1 rounded-md text-xs text-slate-400 font-mono flex items-center gap-2"
            style={{
              background: 'rgba(0,0,0,0.35)',
              boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.5), inset -1px -1px 2px rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#64D2FF' }}>account_tree</span>
            architecture.txt — PandaHub
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SKEUOMORPHIC APP ICON
═══════════════════════════════════════════════════════ */
function AppIcon({ icon, color, gradient }: {
  icon: string;
  color: string;
  gradient: string;
}) {
  return (
    <div
      className="skeu-icon-badge w-14 h-14 flex items-center justify-center relative"
      style={{ background: gradient }}
    >
      <span
        className="material-symbols-outlined relative z-10"
        style={{
          fontSize: 28,
          color: 'white',
          fontVariationSettings: '"FILL" 1',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
        }}
      >
        {icon}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MOBILE BOTTOM NAV — Glassmorphism
═══════════════════════════════════════════════════════ */
function MobileBottomNav({ active = 0 }: { active?: number }) {
  const [activeIdx, setActiveIdx] = useState(active);

  const items = [
    { href: '/explore', icon: 'home',        label: 'Home' },
    { href: '/explore', icon: 'category',    label: 'Product' },
    { href: '/explore', icon: 'code_blocks', label: 'Source' },
    { href: '/login',   icon: 'person',      label: 'Account' },
  ];

  return (
    <div
      className="md:hidden fixed bottom-0 w-full z-50"
      style={{
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        background: 'var(--glass-bg-4)',
        backdropFilter: 'blur(40px) saturate(2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2)',
        borderTop: '1px solid var(--glass-border)',
        boxShadow: '0 -2px 30px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.35)',
      }}
    >
      <nav className="flex justify-around items-center px-2 pt-2">
        {items.map(({ href, icon, label }, i) => (
          <Link
            key={label}
            href={href}
            onClick={() => setActiveIdx(i)}
            className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition-all duration-300 min-w-[56px]"
            style={{
              color: activeIdx === i ? 'var(--color-primary)' : 'var(--text-muted)',
              background: activeIdx === i
                ? 'rgba(10,132,255,0.12)'
                : 'transparent',
              boxShadow: activeIdx === i
                ? '4px 4px 10px var(--neo-shadow-d), -4px -4px 10px var(--neo-shadow-l)'
                : 'none',
              transform: activeIdx === i ? 'translateY(-1px)' : 'none',
            }}
          >
            <span
              className="material-symbols-outlined transition-all duration-300"
              style={{
                fontSize: 22,
                fontVariationSettings: activeIdx === i ? '"FILL" 1' : '"FILL" 0',
                filter: activeIdx === i ? 'drop-shadow(0 2px 6px rgba(10,132,255,0.5))' : 'none',
              }}
            >
              {icon}
            </span>
            <span className="text-[10px] font-semibold tracking-wide">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ANIMATED COUNTER
═══════════════════════════════════════════════════════ */
function AnimatedStat({ value, label, color }: { value: string; label: string; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1">
      <span
        className="text-3xl md:text-4xl font-black tracking-tighter transition-all duration-700"
        style={{
          color,
          filter: visible ? `drop-shadow(0 0 16px ${color}88)` : 'none',
          transform: visible ? 'scale(1)' : 'scale(0.6)',
          opacity: visible ? 1 : 0,
        }}
      >
        {value}
      </span>
      <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SPACE BACKGROUND
═══════════════════════════════════════════════════════ */
const SpaceBackground = dynamic(() => import('./SpaceBackground'), { ssr: false });

/* ═══════════════════════════════════════════════════════
   TYPEWRITER PHRASES
═══════════════════════════════════════════════════════ */
const TYPE_PHRASES = ["next generation.", "AI era.", "future of code.", "speed of thought."];

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════ */
export default function HomePage() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex]     = useState(0);
  const [isDeleting, setIsDeleting]   = useState(false);
  const [text, setText]               = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled]       = useState(false);

  // Track scroll for header style
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Typewriter
  useEffect(() => {
    const phrase = TYPE_PHRASES[phraseIndex];
    if (!phrase) return;
    let timer: NodeJS.Timeout;
    if (isDeleting) {
      timer = setTimeout(() => {
        setText(phrase.substring(0, charIndex - 1));
        setCharIndex(c => c - 1);
        if (charIndex <= 1) {
          setIsDeleting(false);
          setPhraseIndex(p => (p + 1) % TYPE_PHRASES.length);
        }
      }, 45);
    } else {
      timer = setTimeout(() => {
        setText(phrase.substring(0, charIndex + 1));
        setCharIndex(c => c + 1);
        if (charIndex >= phrase.length) {
          setTimeout(() => setIsDeleting(true), 2800);
        }
      }, 90);
    }
    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, phraseIndex]);

  return (
    <main className="min-h-screen text-on-surface font-body relative overflow-hidden bg-transparent">

      {/* ── Animated Space Background ── */}
      <SpaceBackground />

      {/* ── Morphing Blobs — depth layer (Spatial) ── */}
      <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden">
        <div
          className="absolute morphing-blob"
          style={{
            width: '55vw', height: '55vw',
            maxWidth: 700, maxHeight: 700,
            top: '-10%', left: '-10%',
            background: 'radial-gradient(ellipse, rgba(10,132,255,0.18) 0%, rgba(10,132,255,0.04) 70%, transparent 100%)',
          }}
        />
        <div
          className="absolute morphing-blob-alt"
          style={{
            width: '50vw', height: '50vw',
            maxWidth: 600, maxHeight: 600,
            bottom: '5%', right: '-8%',
            background: 'radial-gradient(ellipse, rgba(124,58,237,0.16) 0%, rgba(124,58,237,0.04) 70%, transparent 100%)',
          }}
        />
        <div
          className="absolute morphing-blob"
          style={{
            width: '40vw', height: '40vw',
            maxWidth: 500, maxHeight: 500,
            top: '40%', left: '40%',
            animationDuration: '20s',
            background: 'radial-gradient(ellipse, rgba(6,182,212,0.10) 0%, rgba(6,182,212,0.02) 70%, transparent 100%)',
          }}
        />
      </div>

      {/* ── Mobile Nav Drawer ── */}
      {mobileMenuOpen && (
        <>
          <div
            className="mobile-overlay md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            className="mobile-drawer md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-5"
              style={{
                borderBottom: '1px solid var(--glass-border)',
                background: 'var(--glass-bg-3)',
              }}
            >
              <div className="flex items-center gap-2.5 text-lg font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                <div
                  className="skeu-icon-badge w-8 h-8 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #1a9aff, #0055cc)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'white', fontVariationSettings: '"FILL" 1' }}>cloud_sync</span>
                </div>
                PandaHub
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="btn-icon p-2"
                aria-label="Close menu"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            {/* Links */}
            <nav className="flex flex-col p-3 gap-1">
              {[
                { href: '/explore', label: 'Product',     icon: 'category' },
                { href: '/explore', label: 'Solutions',   icon: 'hub' },
                { href: '/explore', label: 'Open Source', icon: 'code_blocks' },
                { href: '/explore', label: 'Pricing',     icon: 'sell' },
              ].map(({ href, label, icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="sidebar-item"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="material-symbols-outlined icon text-[20px]">{icon}</span>
                  {label}
                </Link>
              ))}
              <div className="my-3" style={{ borderTop: '1px solid var(--glass-border)' }} />
              <a
                href="/login"
                className="skeu-btn-primary btn-ripple flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                Sign In
              </a>
            </nav>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════
          HEADER — Glassmorphism Layer 4
      ═══════════════════════════════════════════════ */}
      <header
        className="fixed top-0 w-full z-50 transition-all duration-500"
        style={{
          background: scrolled ? 'var(--glass-bg-4)' : 'var(--glass-bg-1)',
          backdropFilter: scrolled ? 'blur(40px) saturate(2.2)' : 'blur(6px) saturate(1.4)',
          WebkitBackdropFilter: scrolled ? 'blur(40px) saturate(2.2)' : 'blur(6px) saturate(1.4)',
          borderBottom: `1px solid ${scrolled ? 'var(--glass-border)' : 'transparent'}`,
          boxShadow: scrolled
            ? '0 2px 20px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.4)'
            : 'none',
        }}
      >
        <div className="flex justify-between items-center w-full px-4 sm:px-6 py-3 sm:py-4 max-w-7xl mx-auto">
          {/* Logo — Skeuomorphic badge */}
          <div className="flex items-center gap-2.5 cursor-pointer group">
            <div
              className="skeu-icon-badge w-9 h-9 flex items-center justify-center transition-transform duration-300 group-hover:rotate-12"
              style={{ background: 'linear-gradient(145deg, #1a9aff 0%, #0055cc 100%)' }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18, color: 'white', fontVariationSettings: '"FILL" 1', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}
              >
                cloud_sync
              </span>
            </div>
            <span className="text-xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>PandaHub</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: '/explore', label: 'Product',     active: true },
              { href: '/explore', label: 'Solutions',   active: false },
              { href: '/explore', label: 'Open Source', active: false },
              { href: '/explore', label: 'Pricing',     active: false },
            ].map(({ href, label, active }) => (
              <Link
                key={label}
                href={href}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300"
                style={{
                  color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
                  background: active ? 'rgba(10,132,255,0.10)' : 'transparent',
                  boxShadow: active
                    ? '3px 3px 8px var(--neo-shadow-d), -3px -3px 8px var(--neo-shadow-l)'
                    : 'none',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--glass-bg-2)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* CTA buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/login"
              className="hidden md:block btn-glass btn-ripple text-sm font-semibold px-4 py-2 rounded-xl"
              style={{ color: 'var(--text-primary)' }}
            >
              Sign In
            </a>
            <a
              href="/login"
              className="skeu-btn-primary btn-ripple px-4 sm:px-5 py-2 rounded-xl font-bold text-sm tracking-wide inline-flex items-center gap-2"
            >
              Get Started
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
            </a>
            {/* Hamburger */}
            <button
              className="md:hidden btn-icon p-2"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
              style={{ color: 'var(--text-secondary)' }}
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════
          HERO — Spatial + Glassmorphism
      ═══════════════════════════════════════════════ */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center min-h-screen px-4 sm:px-6 pt-24 pb-28 md:pb-16 max-w-4xl mx-auto">

        {/* Badge pill */}
        <div className="animate-fade-in-up opacity-0 mb-6" style={{ animationFillMode: 'forwards' }}>
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase"
            style={{
              background: 'var(--glass-bg-3)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--glass-border)',
              color: 'var(--color-primary)',
              boxShadow: '0 4px 16px rgba(10,132,255,0.15), inset 0 1px 0 rgba(255,255,255,0.4)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: 'var(--color-success)', boxShadow: '0 0 6px rgba(34,197,94,0.8)' }}
            />
            Now in Public Beta
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>rocket_launch</span>
          </div>
        </div>

        {/* Headline */}
        <h1
          className="animate-fade-in-up-delay text-[clamp(2.2rem,8vw,5rem)] font-black tracking-tighter leading-[1.05] mb-5"
          style={{ color: 'var(--text-primary)', fontFamily: 'Space Grotesk, Inter, sans-serif' }}
        >
          Code hosting for the
          <br />
          <span className="text-gradient-hero">
            {text}
          </span>
          <span
            className="animate-cursor-blink inline-block w-0.5 h-[1em] ml-1 align-middle rounded-full"
            style={{ background: 'var(--color-primary)', verticalAlign: '-0.1em' }}
          />
        </h1>

        {/* Subtitle */}
        <p
          className="animate-fade-in-up-delay-2 text-lg md:text-xl mb-10 max-w-xl font-medium leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          Collaborate, build, and ship with PandaHub. The definitive platform for modern developer teams.
        </p>

        {/* CTA Buttons — Skeuomorphic + Glass */}
        <div className="animate-fade-in-up-delay-3 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <a
            href="/login"
            className="skeu-btn-primary btn-ripple px-8 py-4 rounded-2xl font-bold text-base tracking-wide w-full sm:w-auto flex items-center justify-center gap-2 group min-h-[52px]"
          >
            Get Started Free
            <span className="material-symbols-outlined transition-transform duration-300 group-hover:translate-x-1.5" style={{ fontSize: 20 }}>
              arrow_forward
            </span>
          </a>
          <button
            className="btn-glass btn-ripple px-8 py-4 rounded-2xl font-bold text-base tracking-wide w-full sm:w-auto flex items-center justify-center gap-2 min-h-[52px]"
            style={{ color: 'var(--text-primary)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>terminal</span>
            View Docs
          </button>
        </div>

        {/* Stats row — floating Spatial layer */}
        <div
          className="animate-fade-in-up mt-14 w-full max-w-lg rounded-3xl p-6 grid grid-cols-3 gap-4"
          style={{
            background: 'var(--glass-bg-3)',
            backdropFilter: 'blur(20px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.35)',
          }}
        >
          <AnimatedStat value="50K+"  label="Repos"       color="var(--color-primary)" />
          <AnimatedStat value="12K+"  label="Developers"  color="var(--color-secondary)" />
          <AnimatedStat value="99.9%" label="Uptime"      color="var(--color-success)" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          CODE WINDOW — Skeuomorphism
      ═══════════════════════════════════════════════ */}
      <RevealOnScroll className="w-full max-w-5xl mx-auto px-4 sm:px-6 mb-32 relative z-10">
        <SkeuWindow>
          <div
            className="p-5 sm:p-7 md:p-8 font-mono text-xs sm:text-sm overflow-x-auto"
            style={{
              background: 'linear-gradient(160deg, #0d1117 0%, #0a0e16 100%)',
              backgroundImage: `
                radial-gradient(at 0% 100%, rgba(10,132,255,0.06) 0, transparent 50%),
                radial-gradient(at 100% 0%, rgba(124,58,237,0.06) 0, transparent 50%)
              `,
            }}
          >
            <pre style={{ color: '#8b9eb7' }}>
              <code>
                <span style={{ color: '#30D158', fontWeight: 700 }}>FastAPI Application</span>
                <span style={{ color: '#64748b' }}> (The Brain)</span>{'\n'}
                {'│   ├── '}
                <span style={{ color: '#64D2FF' }}>app/</span>{'\n'}
                {'│   │   ├── '}
                <span style={{ color: '#64D2FF' }}>api/</span>
                <span style={{ color: '#475569' }}>              # RESTful routing (users, repos, issues)</span>{'\n'}
                {'│   │   ├── '}
                <span style={{ color: '#64D2FF' }}>models/</span>
                <span style={{ color: '#475569' }}>           # SQLAlchemy database schemas</span>{'\n'}
                {'│   │   └── '}
                <span style={{ color: '#64D2FF' }}>services/</span>
                <span style={{ color: '#475569' }}>         # Business logic (auth, permissions)</span>{'\n'}
                {'│\n'}
                {'├── '}
                <span style={{ color: '#BF5AF2', fontWeight: 700 }}>git-server/</span>
                <span style={{ color: '#475569' }}>               # The Protocol Layer (Go/Rust/Python)</span>{'\n'}
                {'│   ├── '}
                <span style={{ color: '#64D2FF' }}>ssh_handler/</span>
                <span style={{ color: '#475569' }}>          # Validates SSH keys for push/pull</span>{'\n'}
                {'│   └── '}
                <span style={{ color: '#64D2FF' }}>git_engine/</span>
                <span style={{ color: '#475569' }}>           # Talks directly to the LibGit2 C-library</span>{'\n'}
                {'│\n'}
                {'└── '}
                <span style={{ color: '#FF6B6B', fontWeight: 700 }}>infrastructure/</span>
                <span style={{ color: '#475569' }}>           # Deployment & DevOps</span>{'\n'}
                {'    ├── '}
                docker-compose.yml
                <span style={{ color: '#475569' }}>    # Runs Postgres, Redis, and services locally</span>{'\n'}
                {'    └── '}
                <span style={{ color: '#64D2FF' }}>runners/</span>
                <span style={{ color: '#475569' }}>              # Scripts to spin up isolated CI/CD containers</span>
              </code>
            </pre>
          </div>
        </SkeuWindow>
      </RevealOnScroll>

      {/* ═══════════════════════════════════════════════
          FEATURE CARDS — Neomorphism + Spatial
      ═══════════════════════════════════════════════ */}
      <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 mb-32 relative z-10">
        <RevealOnScroll className="text-center mb-14">
          <h2
            className="text-3xl md:text-5xl font-black tracking-tighter mb-4"
            style={{ color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Everything you need to{' '}
            <span className="text-gradient-hero">ship faster</span>
          </h2>
          <p className="text-lg font-medium max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            An integrated platform built for modern teams who move at the speed of thought.
          </p>
        </RevealOnScroll>

        <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar md:grid md:grid-cols-3 gap-5 pb-4">
          {[
            {
              icon: 'source',
              title: 'Version Control',
              subtitle: 'Hosting Service',
              desc: 'Its core function is hosting Git repositories. It acts as the central server where a permanent, tracked history of source code is stored, allowing you to branch off, experiment, and merge code safely.',
              gradient: 'linear-gradient(145deg, #1a9aff 0%, #0055cc 100%)',
              glowColor: 'rgba(10,132,255,0.3)',
            },
            {
              icon: 'group',
              title: 'Collaborative',
              subtitle: 'Dev Platform',
              desc: 'Built-in tools for tracking bugs (Issues), planning sprints, and reviewing code (Pull Requests) before it is integrated into the main codebase.',
              gradient: 'linear-gradient(145deg, #a855f7 0%, #6d28d9 100%)',
              glowColor: 'rgba(124,58,237,0.3)',
            },
            {
              icon: 'rocket_launch',
              title: 'CI/CD &',
              subtitle: 'Automation Platform',
              desc: 'Through PandaHub Actions, the platform can automatically run tests and trigger live deployments directly to external hosting environments like Vercel.',
              gradient: 'linear-gradient(145deg, #34d399 0%, #059669 100%)',
              glowColor: 'rgba(34,197,94,0.3)',
            },
          ].map(({ icon, title, subtitle, desc, gradient, glowColor }, i) => (
            <RevealOnScroll key={title} delay={i * 100} className="flex-none w-[84vw] md:w-auto snap-center">
              <TiltCard className="neo-card p-7 flex flex-col gap-5 cursor-default h-full">
                {/* Skeuomorphic app icon */}
                <AppIcon icon={icon} color="#fff" gradient={gradient} />

                <div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                    {subtitle}
                  </p>
                  <h3
                    className="text-xl font-black leading-tight"
                    style={{ color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}
                  >
                    {title}
                  </h3>
                </div>

                <p className="text-sm leading-relaxed flex-grow" style={{ color: 'var(--text-secondary)' }}>
                  {desc}
                </p>

                {/* Neo progress indicator */}
                <div
                  className="w-full h-1 rounded-full neo-inset overflow-hidden"
                  style={{ background: 'var(--neo-bg)' }}
                >
                  <div
                    className="h-full rounded-full animate-gradient"
                    style={{
                      width: '70%',
                      background: gradient,
                      backgroundSize: '200% 200%',
                      boxShadow: `0 0 8px ${glowColor}`,
                    }}
                  />
                </div>
              </TiltCard>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          ARCHITECTURE BENTO — Spatial + Glass + Neo
      ═══════════════════════════════════════════════ */}
      <RevealOnScroll className="w-full max-w-6xl mx-auto px-4 sm:px-6 mb-32 relative z-10">
        <div className="text-center mb-14">
          <h2
            className="text-3xl md:text-5xl font-black tracking-tighter mb-4"
            style={{ color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Platform{' '}
            <span className="text-gradient-hero">Architecture</span>
          </h2>
          <p className="font-medium text-lg max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Built from the ground up for massive scale, extreme concurrency, and unbreakable security.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">

          {/* 1. Protocol Layer — Glassmorphism */}
          <RevealOnScroll delay={0} className="lg:col-span-8">
            <div
              className="glass-layer-3 p-7 rounded-3xl group relative overflow-hidden transition-all duration-500 h-full"
              style={{
                border: '1px solid var(--glass-border)',
                boxShadow: '0 8px 40px rgba(10,132,255,0.08), inset 0 1px 0 rgba(255,255,255,0.3)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 16px 60px rgba(10,132,255,0.15), inset 0 1px 0 rgba(255,255,255,0.4), 0 0 0 1px rgba(10,132,255,0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 8px 40px rgba(10,132,255,0.08), inset 0 1px 0 rgba(255,255,255,0.3)';
              }}
            >
              <div className="absolute top-0 right-0 w-56 h-56 rounded-full -mr-16 -mt-16 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse, rgba(10,132,255,0.12) 0%, transparent 70%)' }} />

              <div className="flex items-center gap-3 mb-5 relative z-10">
                <div className="skeu-icon-badge w-11 h-11 flex items-center justify-center"
                  style={{ background: 'linear-gradient(145deg, #1a9aff, #0044bb)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'white', fontVariationSettings: '"FILL" 1' }}>terminal</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-primary)' }}>Layer 01</p>
                  <h3 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>The Protocol Layer</h3>
                </div>
              </div>
              <p className="text-sm mb-6 relative z-10" style={{ color: 'var(--text-secondary)' }}>
                The engine that speaks directly to developers&apos; local terminals.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                {[
                  { icon: 'key', label: 'SSH Server', desc: 'Handles secure connections, verifies keys, and routes git-receive-pack commands.', color: '#0A84FF' },
                  { icon: 'http', label: 'Smart HTTP', desc: 'Efficient stream processing over HTTPS so massive codebases don\'t crash memory.', color: '#30D158' },
                  { icon: 'memory', label: 'Git Abstraction', desc: 'Low-level library parsing raw Git objects directly for instant frontend diffs.', color: '#BF5AF2' },
                ].map(({ icon, label, desc, color }) => (
                  <div
                    key={label}
                    className="neo-inset p-4 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
                    style={{ background: 'var(--neo-bg)' }}
                  >
                    <h4 className="font-black text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color }}>{icon}</span>
                      {label}
                    </h4>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </RevealOnScroll>

          {/* 2. Dual Storage — Neomorphism */}
          <RevealOnScroll delay={80} className="lg:col-span-4">
            <div
              className="neo-card p-7 rounded-3xl flex flex-col h-full"
              style={{ background: 'var(--neo-bg)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="skeu-icon-badge w-11 h-11 flex items-center justify-center"
                  style={{ background: 'linear-gradient(145deg, #fb923c, #c2410c)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'white', fontVariationSettings: '"FILL" 1' }}>database</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f97316' }}>Layer 02</p>
                  <h3 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Dual-Storage</h3>
                </div>
              </div>
              <p className="text-sm mb-5 flex-grow" style={{ color: 'var(--text-secondary)' }}>
                A split architecture to separate metadata from raw blobs.
              </p>
              <div className="space-y-3">
                {[
                  { icon: 'table', label: 'Relational DB', sub: 'PostgreSQL for users, issues, PRs.' },
                  { icon: 'folder_zip', label: 'Object Storage', sub: 'AWS S3/MinIO for raw Git files & LFS.' },
                ].map(({ icon, label, sub }) => (
                  <div
                    key={label}
                    className="neo-inset flex items-start gap-3 p-3.5 rounded-2xl"
                    style={{ background: 'var(--neo-bg)' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#f97316', marginTop: 1 }}>{icon}</span>
                    <div>
                      <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{label}</h4>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </RevealOnScroll>

          {/* 3. Web App & API — Glass */}
          <RevealOnScroll delay={140} className="lg:col-span-5">
            <div
              className="glass-layer-3 p-7 rounded-3xl relative overflow-hidden h-full transition-all duration-500"
              style={{
                border: '1px solid var(--glass-border)',
                boxShadow: '0 8px 40px rgba(244,63,94,0.07), inset 0 1px 0 rgba(255,255,255,0.3)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 16px 60px rgba(244,63,94,0.14), inset 0 1px 0 rgba(255,255,255,0.4), 0 0 0 1px rgba(244,63,94,0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 8px 40px rgba(244,63,94,0.07), inset 0 1px 0 rgba(255,255,255,0.3)';
              }}
            >
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(244,63,94,0.08) 0%, transparent 70%)' }} />

              <div className="flex items-center gap-3 mb-5 relative z-10">
                <div className="skeu-icon-badge w-11 h-11 flex items-center justify-center"
                  style={{ background: 'linear-gradient(145deg, #f87171, #be123c)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'white', fontVariationSettings: '"FILL" 1' }}>api</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f43f5e' }}>Layer 03</p>
                  <h3 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Web App & API</h3>
                </div>
              </div>

              <div className="space-y-4 relative z-10">
                {[
                  { dot: '#f43f5e', label: 'Dynamic Frontend', sub: 'Next.js & React for file trees and side-by-side diffs.' },
                  { dot: '#f43f5e', label: 'Fast Backend API',  sub: 'Go/Rust/FastAPI for concurrent user auth and permissions.' },
                  { dot: '#f43f5e', label: 'Search Engine',     sub: 'Elasticsearch to index millions of files instantly.' },
                ].map(({ dot, label, sub }) => (
                  <div key={label}>
                    <h4 className="font-black text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot, boxShadow: `0 0 6px ${dot}` }} />
                      {label}
                    </h4>
                    <p className="text-xs leading-relaxed pl-4 mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </RevealOnScroll>

          {/* 4. Workers & CI/CD — Neo + Glass hybrid */}
          <RevealOnScroll delay={200} className="lg:col-span-7">
            <div
              className="glass-layer-3 p-7 rounded-3xl relative overflow-hidden h-full transition-all duration-500"
              style={{
                border: '1px solid var(--glass-border)',
                boxShadow: '0 8px 40px rgba(34,197,94,0.07), inset 0 1px 0 rgba(255,255,255,0.3)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 16px 60px rgba(34,197,94,0.14), inset 0 1px 0 rgba(255,255,255,0.4), 0 0 0 1px rgba(34,197,94,0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 8px 40px rgba(34,197,94,0.07), inset 0 1px 0 rgba(255,255,255,0.3)';
              }}
            >
              <div className="absolute right-0 bottom-0 w-48 h-48 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse, rgba(34,197,94,0.10) 0%, transparent 70%)' }} />

              <div className="flex items-center gap-3 mb-5 relative z-10">
                <div className="skeu-icon-badge w-11 h-11 flex items-center justify-center"
                  style={{ background: 'linear-gradient(145deg, #4ade80, #15803d)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'white', fontVariationSettings: '"FILL" 1' }}>conveyor_belt</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#22c55e' }}>Layer 04</p>
                  <h3 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Workers & CI/CD</h3>
                </div>
              </div>
              <p className="text-sm mb-6 relative z-10" style={{ color: 'var(--text-secondary)' }}>
                Doing the heavy lifting asynchronously to keep the platform lightning fast.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                {[
                  { icon: 'queue', label: 'Message Brokers', desc: 'Redis or RabbitMQ queue background tasks like notifications and webhook triggers.' },
                  { icon: 'dns',   label: 'Runner Infrastructure', desc: 'Isolated Docker & Kubernetes clusters to safely execute untrusted CI build scripts.' },
                ].map(({ icon, label, desc }) => (
                  <div
                    key={label}
                    className="flex-1 neo-inset p-5 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
                    style={{ background: 'var(--neo-bg)' }}
                  >
                    <span className="material-symbols-outlined mb-3 block" style={{ fontSize: 22, color: '#22c55e' }}>{icon}</span>
                    <h4 className="font-black text-sm mb-2" style={{ color: 'var(--text-primary)' }}>{label}</h4>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </RevealOnScroll>

      {/* ═══════════════════════════════════════════════
          FINAL CTA BANNER — Skeuomorphism
      ═══════════════════════════════════════════════ */}
      <RevealOnScroll className="w-full max-w-4xl mx-auto px-4 sm:px-6 mb-32 relative z-10">
        <div
          className="rounded-3xl p-10 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0a1628 0%, #0f2044 50%, #0a1628 100%)',
            boxShadow: `
              inset 0 1px 0 rgba(255,255,255,0.12),
              inset 0 -1px 0 rgba(0,0,0,0.4),
              0 32px 80px rgba(0,0,0,0.4),
              0 12px 32px rgba(10,132,255,0.15)
            `,
            border: '1px solid rgba(10,132,255,0.25)',
          }}
        >
          {/* Inner gloss */}
          <div
            className="absolute top-0 left-0 right-0 h-1/2 pointer-events-none rounded-3xl"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)' }}
          />
          {/* Orbs */}
          <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, rgba(10,132,255,0.18) 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.18) 0%, transparent 70%)' }} />

          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 text-white">
              Ready to build the future?
            </h2>
            <p className="text-lg mb-8 font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Join thousands of developers already shipping faster with PandaHub.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/login"
                className="skeu-btn-primary btn-ripple px-8 py-4 rounded-2xl font-bold text-base tracking-wide inline-flex items-center justify-center gap-2 group"
              >
                Start for Free
                <span className="material-symbols-outlined transition-transform duration-300 group-hover:translate-x-1.5" style={{ fontSize: 20 }}>
                  arrow_forward
                </span>
              </a>
              <a
                href="/explore"
                className="btn-glass btn-ripple px-8 py-4 rounded-2xl font-bold text-base inline-flex items-center justify-center gap-2"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>explore</span>
                Explore Projects
              </a>
            </div>
          </div>
        </div>
      </RevealOnScroll>

      {/* ═══════════════════════════════════════════════
          FOOTER — Glass
      ═══════════════════════════════════════════════ */}
      <footer
        className="w-full relative z-10 transition-colors duration-300"
        style={{
          background: 'var(--glass-bg-4)',
          backdropFilter: 'blur(32px) saturate(2)',
          WebkitBackdropFilter: 'blur(32px) saturate(2)',
          borderTop: '1px solid var(--glass-border)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
        }}
      >
        <div className="flex flex-col md:flex-row justify-between items-center py-8 px-6 max-w-7xl mx-auto gap-6">
          <div className="flex items-center gap-2.5 font-black text-lg" style={{ color: 'var(--text-primary)' }}>
            <div
              className="skeu-icon-badge w-8 h-8 flex items-center justify-center"
              style={{ background: 'linear-gradient(145deg, #1a9aff, #0055cc)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'white', fontVariationSettings: '"FILL" 1' }}>cloud_sync</span>
            </div>
            PandaHub
          </div>

          <nav className="flex flex-wrap justify-center gap-6 text-sm">
            {['Security', 'Privacy', 'Terms', 'Docs', 'Status'].map(link => (
              <Link
                key={link}
                href="/explore"
                className="font-semibold transition-all duration-200 hover:underline decoration-primary underline-offset-4"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                {link}
              </Link>
            ))}
          </nav>

          <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            © 2027 PandaHub, Inc.
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav active={0} />

      {/* Settings */}
      <Settings />
    </main>
  );
}