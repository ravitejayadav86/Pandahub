"use client";
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Settings from './Settings';

function TiltCard({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = event.clientX - rect.left - width / 2;
    const mouseY = event.clientY - rect.top - height / 2;
    
    // Map mouse position to rotation angle [-15, 15]
    const rotX = -(mouseY / (height / 2)) * 15;
    const rotY = (mouseX / (width / 2)) * 15;
    
    setRotate({ x: rotX, y: rotY });
  }

  function handleMouseLeave() {
    setRotate({ x: 0, y: 0 });
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
        transformStyle: "preserve-3d",
        transition: "transform 0.15s ease-out",
        ...style
      }}
      className={className}
    >
      <div style={{ transform: "translateZ(30px)", transformStyle: "preserve-3d" }}>
        {children}
      </div>
    </div>
  );
}

function RevealOnScroll({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: "-50px" }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] transform ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-[0.96]'
      } ${className}`}
    >
      {children}
    </div>
  );
}

const SpaceBackground = dynamic(() => import('./SpaceBackground'), { ssr: false });

const TYPE_PHRASES = ["next generation.", "AI era.", "future of code."];

function MobileBottomNav() {
  return (
    <div className="md:hidden fixed bottom-0 w-full z-50 glass-panel border-t border-glass-border pb-safe">
      <nav className="flex justify-around items-center px-2 py-3">
        <Link href="/explore" className="flex flex-col items-center gap-1 text-primary">
          <span className="material-symbols-outlined text-[24px]" style={{fontVariationSettings: '"FILL" 1'}}>home</span>
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        <Link href="/explore" className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-[24px]">category</span>
          <span className="text-[10px] font-medium">Product</span>
        </Link>
        <Link href="/explore" className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-[24px]">code_blocks</span>
          <span className="text-[10px] font-medium">Open Source</span>
        </Link>
        <a href="/login" className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-[24px]">person</span>
          <span className="text-[10px] font-medium">Account</span>
        </a>
      </nav>
    </div>
  );
}

export default function HomePage() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    const currentPhrase = TYPE_PHRASES[phraseIndex];
    if (!currentPhrase) return;

    let timer: NodeJS.Timeout;
    if (isDeleting) {
      timer = setTimeout(() => {
        setText(currentPhrase.substring(0, charIndex - 1));
        setCharIndex(c => c - 1);
        if (charIndex <= 1) {
          setIsDeleting(false);
          setPhraseIndex((phraseIndex + 1) % TYPE_PHRASES.length);
        }
      }, 50);
    } else {
      timer = setTimeout(() => {
        setText(currentPhrase.substring(0, charIndex + 1));
        setCharIndex(c => c + 1);
        if (charIndex >= currentPhrase.length) {
          setTimeout(() => setIsDeleting(true), 2500);
        }
      }, 100);
    }
    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, phraseIndex]);

  return (
    <main className="min-h-screen text-on-surface font-body relative overflow-hidden bg-transparent transition-colors duration-300">

      {/* Live Animated Space Background */}
      <SpaceBackground />

      {/* Header */}
      <header className="fixed top-0 w-full z-50 backdrop-blur-xl border-b border-border-color bg-glass-bg transition-colors duration-300">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-xl font-bold tracking-tighter text-on-surface cursor-pointer">
            <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: '"FILL" 1'}}>cloud_sync</span>
            <span>PandaHub</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="/explore" className="text-primary font-semibold border-b-2 border-primary pb-1 transition-colors">Product</Link>
            <Link href="/explore" className="text-on-surface-variant hover:text-on-surface transition-colors duration-200 px-3 py-1 rounded-lg hover:bg-black/5">Solutions</Link>
            <Link href="/explore" className="text-on-surface-variant hover:text-on-surface transition-colors duration-200 px-3 py-1 rounded-lg hover:bg-black/5">Open Source</Link>
            <Link href="/explore" className="text-on-surface-variant hover:text-on-surface transition-colors duration-200 px-3 py-1 rounded-lg hover:bg-black/5">Pricing</Link>
          </nav>

          <div className="flex items-center gap-3">
            <a href="/login" className="hidden md:block text-on-surface hover:text-primary transition-colors text-sm font-semibold px-4 py-2 rounded-lg btn-glass btn-ripple">Sign In</a>
            <a href="/login" className="bg-primary text-white px-5 py-2 rounded-lg font-bold text-sm tracking-wide btn-glow btn-ripple inline-block">Get Started</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center min-h-screen px-4 sm:px-6 pt-24 pb-12 max-w-4xl mx-auto animate-fade-in-up">
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tighter text-on-surface mb-4 leading-tight font-display">
          Code hosting for the
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0A84FF] via-[#BF5AF2] to-[#30D158] border-r-4 border-[#0A84FF] pr-2 mt-1 inline-block">
            {text}
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-on-surface-variant mb-10 max-w-2xl font-medium leading-relaxed">
          Collaborate, build, and ship with PandaHub. The definitive platform for modern developer teams.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <a href="/login" className="bg-primary text-white px-8 py-4 rounded-xl font-bold text-lg tracking-wide btn-glow btn-ripple w-full sm:w-auto flex items-center justify-center gap-2 group min-h-[48px]">
            Get Started Free
            <span className="material-symbols-outlined group-hover:translate-x-1.5 transition-transform duration-300">arrow_forward</span>
          </a>
          <button className="btn-glass btn-ripple text-on-surface px-8 py-4 rounded-xl font-bold text-lg tracking-wide w-full sm:w-auto flex items-center justify-center gap-2 min-h-[48px]">
            <span className="material-symbols-outlined">terminal</span>
            View Docs
          </button>
        </div>
      </section>

      {/* Code Window */}
      <RevealOnScroll className="w-full max-w-5xl mx-auto px-6 mb-28 relative z-10">
        <div className="glass-panel rounded-2xl overflow-hidden border border-border-color shadow-md hover:border-primary/20 transition-all duration-500">
          <div className="px-4 py-3 flex items-center gap-4 border-b border-border-color bg-black/[0.03]">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FF5F57]"></div>
              <div className="w-3 h-3 rounded-full bg-[#FEBC2E]"></div>
              <div className="w-3 h-3 rounded-full bg-[#28C840]"></div>
            </div>
            <div className="flex-grow flex justify-center">
              <div className="bg-black/5 px-4 py-1 rounded-md text-xs text-on-surface-variant font-mono flex items-center gap-2">
                <span className="material-symbols-outlined text-[13px]">account_tree</span>
                architecture.txt — PandaHub
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6 md:p-8 font-mono text-xs sm:text-sm md:text-base overflow-x-auto bg-white/40">
            <pre className="text-on-surface-variant"><code><span className="text-[#30D158] font-bold">FastAPI Application (The Brain)</span>
│   ├── <span className="text-[#0A84FF]">app/</span>
│   │   ├── <span className="text-[#0A84FF]">api/</span>              <span className="text-outline"># RESTful routing (users, repos, issues)</span>
│   │   ├── <span className="text-[#0A84FF]">models/</span>           <span className="text-outline"># SQLAlchemy database schemas</span>
│   │   └── <span className="text-[#0A84FF]">services/</span>         <span className="text-outline"># Business logic (auth, permissions)</span>
│
├── <span className="text-[#BF5AF2] font-bold">git-server/</span>               <span className="text-outline"># The Protocol Layer (Go/Rust/Python)</span>
│   ├── <span className="text-[#0A84FF]">ssh_handler/</span>          <span className="text-outline"># Validates SSH keys for push/pull</span>
│   └── <span className="text-[#0A84FF]">git_engine/</span>           <span className="text-outline"># Talks directly to the LibGit2 C-library</span>
│
└── <span className="text-[#FF6B6B] font-bold">infrastructure/</span>           <span className="text-outline"># Deployment & DevOps</span>
    ├── docker-compose.yml    <span className="text-outline"># Runs Postgres, Redis, and services locally</span>
    └── <span className="text-[#0A84FF]">runners/</span>              <span className="text-outline"># Scripts to spin up isolated CI/CD containers</span></code></pre>
          </div>
        </div>
      </RevealOnScroll>

      {/* Feature Cards */}
      <RevealOnScroll className="w-full max-w-6xl mx-auto flex overflow-x-auto snap-x snap-mandatory hide-scrollbar md:grid md:grid-cols-3 gap-4 sm:gap-6 px-4 sm:px-6 mb-28 relative z-10 pb-8">
        {[
          { icon: 'source', title: 'Version Control Hosting Service', desc: 'Its core function is hosting Git repositories. It acts as the central server where a permanent, tracked history of source code is stored, allowing you to branch off, experiment, and merge code safely.', color: '#0A84FF' },
          { icon: 'group', title: 'Collaborative Development Platform', desc: 'It provides the interface for project management. It includes built-in tools for tracking bugs (Issues), planning sprints with project boards, and reviewing code (Pull Requests) before it is integrated into the main codebase.', color: '#BF5AF2' },
          { icon: 'rocket_launch', title: 'CI/CD & Automation Platform', desc: 'Through features like PandaHub Actions, it functions as an automation engine. When you push updates to a full-stack web application, the platform can automatically run tests and trigger live deployments directly to external hosting environments like Vercel.', color: '#30D158' },
        ].map(({ icon, title, desc, color }) => (
          <TiltCard key={title} className="glass-panel p-8 rounded-2xl flex flex-col gap-4 group cursor-default transition-all duration-300 hover:shadow-lg flex-none w-[85vw] md:w-auto snap-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
              style={{ background: `${color}15`, color, boxShadow: `0 0 0 1px ${color}22` }}>
              <span className="material-symbols-outlined" style={{fontVariationSettings: '"FILL" 1'}}>{icon}</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface font-headline transition-colors duration-200" onMouseEnter={e => (e.currentTarget.style.color = color)} onMouseLeave={e => (e.currentTarget.style.color = '')}>{title}</h3>
            <p className="text-on-surface-variant leading-relaxed">{desc}</p>
          </TiltCard>
        ))}
      </RevealOnScroll>

      {/* Architecture Bento Box */}
      <RevealOnScroll className="w-full max-w-6xl mx-auto px-4 sm:px-6 mb-28 relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter text-on-surface mb-4 font-display">
            Platform <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">Architecture</span>
          </h2>
          <p className="text-on-surface-variant max-w-2xl mx-auto font-medium text-lg">
            Built from the ground up for massive scale, extreme concurrency, and unbreakable security.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
          {/* 1. Protocol Layer (Spans 8 columns) */}
          <div className="lg:col-span-8 glass-panel p-8 rounded-3xl group hover:border-primary/30 transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -mr-20 -mt-20"></div>
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <span className="material-symbols-outlined text-3xl text-blue-500">terminal</span>
              <h3 className="text-2xl font-bold text-on-surface">1. The Protocol Layer</h3>
            </div>
            <p className="text-on-surface-variant mb-6 relative z-10">The engine that speaks directly to developers&apos; local terminals.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
              <div className="bg-surface-container/50 p-4 rounded-2xl border border-outline-variant/10">
                <h4 className="font-bold text-on-surface mb-2 flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-primary">key</span> SSH Server</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">Handles secure connections, verifies keys, and routes git-receive-pack commands.</p>
              </div>
              <div className="bg-surface-container/50 p-4 rounded-2xl border border-outline-variant/10">
                <h4 className="font-bold text-on-surface mb-2 flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-green-500">http</span> Smart HTTP</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">Efficient stream processing over HTTPS so massive codebases don&apos;t crash memory.</p>
              </div>
              <div className="bg-surface-container/50 p-4 rounded-2xl border border-outline-variant/10">
                <h4 className="font-bold text-on-surface mb-2 flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-purple-500">memory</span> Git Abstraction</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">Low-level library parsing raw Git objects directly for instant frontend diffs.</p>
              </div>
            </div>
          </div>

          {/* 2. Dual Storage (Spans 4 columns) */}
          <div className="lg:col-span-4 glass-panel p-8 rounded-3xl group hover:border-orange-500/30 transition-colors relative overflow-hidden flex flex-col">
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/10 rounded-full blur-[60px] -ml-10 -mb-10"></div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <span className="material-symbols-outlined text-3xl text-orange-500">database</span>
              <h3 className="text-2xl font-bold text-on-surface">2. Dual-Storage</h3>
            </div>
            <p className="text-on-surface-variant text-sm mb-6 flex-grow relative z-10">A split architecture to separate metadata from raw blobs.</p>
            <div className="space-y-3 relative z-10">
              <div className="flex items-start gap-3 bg-surface-container-lowest/50 p-3 rounded-xl border border-outline-variant/10">
                <span className="material-symbols-outlined text-orange-400 mt-0.5">table</span>
                <div>
                  <h4 className="text-sm font-bold text-on-surface">Relational DB</h4>
                  <p className="text-[11px] text-on-surface-variant">PostgreSQL for users, issues, PRs.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-surface-container-lowest/50 p-3 rounded-xl border border-outline-variant/10">
                <span className="material-symbols-outlined text-orange-400 mt-0.5">folder_zip</span>
                <div>
                  <h4 className="text-sm font-bold text-on-surface">Object Storage</h4>
                  <p className="text-[11px] text-on-surface-variant">AWS S3/MinIO for raw Git files & LFS.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Web App & API (Spans 5 columns) */}
          <div className="lg:col-span-5 glass-panel p-8 rounded-3xl group hover:border-pink-500/30 transition-colors relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-500/10 rounded-full blur-[80px]"></div>
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <span className="material-symbols-outlined text-3xl text-pink-500">api</span>
              <h3 className="text-2xl font-bold text-on-surface">3. Web App & API</h3>
            </div>
            <div className="space-y-4 relative z-10">
              <div>
                <h4 className="font-bold text-on-surface flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span> Dynamic Frontend</h4>
                <p className="text-xs text-on-surface-variant pl-3.5 mt-1">Next.js & React for file trees and side-by-side diffs.</p>
              </div>
              <div>
                <h4 className="font-bold text-on-surface flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span> Fast Backend API</h4>
                <p className="text-xs text-on-surface-variant pl-3.5 mt-1">Go/Rust/FastAPI for concurrent user auth and permissions.</p>
              </div>
              <div>
                <h4 className="font-bold text-on-surface flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span> Search Engine</h4>
                <p className="text-xs text-on-surface-variant pl-3.5 mt-1">Elasticsearch to index millions of files instantly.</p>
              </div>
            </div>
          </div>

          {/* 4. Background Workers (Spans 7 columns) */}
          <div className="lg:col-span-7 glass-panel p-8 rounded-3xl group hover:border-green-500/30 transition-colors relative overflow-hidden">
             <div className="absolute right-0 bottom-0 w-64 h-64 bg-green-500/10 rounded-full blur-[80px]"></div>
             <div className="flex items-center gap-3 mb-6 relative z-10">
              <span className="material-symbols-outlined text-3xl text-green-500">conveyor_belt</span>
              <h3 className="text-2xl font-bold text-on-surface">4. Workers & CI/CD</h3>
            </div>
            <p className="text-on-surface-variant mb-6 relative z-10">Doing the heavy lifting asynchronously to keep the platform lightning fast.</p>
            <div className="flex flex-col sm:flex-row gap-4 relative z-10">
              <div className="flex-1 bg-surface-container/50 p-5 rounded-2xl border border-outline-variant/10">
                <span className="material-symbols-outlined text-2xl text-green-400 mb-3 block">queue</span>
                <h4 className="font-bold text-on-surface mb-2">Message Brokers</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">Redis or RabbitMQ queue background tasks like notifications and webhook triggers.</p>
              </div>
              <div className="flex-1 bg-surface-container/50 p-5 rounded-2xl border border-outline-variant/10">
                <span className="material-symbols-outlined text-2xl text-green-400 mb-3 block">dns</span>
                <h4 className="font-bold text-on-surface mb-2">Runner Infrastructure</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">Isolated Docker & Kubernetes clusters to safely execute untrusted CI build scripts.</p>
              </div>
            </div>
          </div>
        </div>
      </RevealOnScroll>

      {/* Footer */}
      <footer className="w-full border-t border-border-color bg-glass-bg relative z-10 transition-colors duration-300">
        <div className="flex flex-col md:flex-row justify-between items-center py-10 px-8 max-w-7xl mx-auto gap-6">
          <div className="text-lg font-black text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: '"FILL" 1'}}>cloud_sync</span>
            PandaHub
          </div>
          <nav className="flex flex-wrap justify-center gap-6 text-sm">
            {['Security', 'Privacy', 'Terms', 'Docs', 'Status'].map(link => (
              <Link key={link} href="/explore" className="text-outline hover:text-on-surface transition-colors duration-200 hover:underline decoration-primary underline-offset-4">{link}</Link>
            ))}
          </nav>
          <div className="text-outline text-xs">© 2027 PandaHub, Inc.</div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* Settings toggle */}
      <Settings />
    </main>
  );
}