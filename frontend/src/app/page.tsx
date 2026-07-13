"use client";
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import Settings from './Settings';

function TiltCard({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-150, 150], [15, -15]);
  const rotateY = useTransform(x, [-150, 150], [-15, 15]);

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = event.clientX - rect.left - width / 2;
    const mouseY = event.clientY - rect.top - height / 2;
    x.set(mouseX);
    y.set(mouseY);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 1000,
        ...style
      }}
      className={className}
    >
      <div style={{ transform: "translateZ(30px)", transformStyle: "preserve-3d" }}>
        {children}
      </div>
    </motion.div>
  );
}

const SpaceBackground = dynamic(() => import('./SpaceBackground'), { ssr: false });

const TYPE_PHRASES = ["next generation.", "AI era.", "future of code."];

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
      <motion.section 
        initial={{ opacity: 0, scale: 0.94, y: 30 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} 
        className="relative z-10 flex flex-col items-center justify-center text-center min-h-screen px-4 sm:px-6 pt-24 pb-12 max-w-4xl mx-auto"
      >
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
          <a href="/login" className="bg-primary text-white px-8 py-4 rounded-xl font-bold text-lg tracking-wide btn-glow btn-ripple w-full sm:w-auto flex items-center justify-center gap-2 group">
            Get Started Free
            <span className="material-symbols-outlined group-hover:translate-x-1.5 transition-transform duration-300">arrow_forward</span>
          </a>
          <button className="btn-glass btn-ripple text-on-surface px-8 py-4 rounded-xl font-bold text-lg tracking-wide w-full sm:w-auto flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">terminal</span>
            View Docs
          </button>
        </div>
      </motion.section>

      {/* Code Window */}
      <motion.section 
        initial={{ opacity: 0, y: -60, scale: 0.96 }} 
        whileInView={{ opacity: 1, y: 0, scale: 1 }} 
        viewport={{ once: true, margin: "-120px" }} 
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} 
        className="w-full max-w-5xl mx-auto px-6 mb-28 relative z-10"
      >
        <div className="glass-panel rounded-2xl overflow-hidden border border-border-color shadow-md hover:border-primary/20 transition-all duration-500">
          <div className="px-4 py-3 flex items-center gap-4 border-b border-border-color bg-black/[0.03]">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FF5F57]"></div>
              <div className="w-3 h-3 rounded-full bg-[#FEBC2E]"></div>
              <div className="w-3 h-3 rounded-full bg-[#28C840]"></div>
            </div>
            <div className="flex-grow flex justify-center">
              <div className="bg-black/5 px-4 py-1 rounded-md text-xs text-on-surface-variant font-mono flex items-center gap-2">
                <span className="material-symbols-outlined text-[13px]">lock</span>
                main.py — PandaHub
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6 md:p-8 font-mono text-xs sm:text-sm md:text-base overflow-x-auto bg-white/40">
            <pre className="text-on-surface-variant"><code><span className="text-[#BF5AF2]">import</span> asyncio
<span className="text-[#BF5AF2]">from</span> pandahub <span className="text-[#BF5AF2]">import</span> Client, Repository

<span className="text-outline"># Initialize the next-gen PandaHub client</span>
<span className="text-[#0A84FF]">async def</span> <span className="text-[#30D158]">deploy_next_gen_app</span>():
    client = Client(api_key=<span className="text-[#FF6B6B]">"pd_live_..."</span>)
    
    repo = <span className="text-[#BF5AF2]">await</span> client.get_repository(<span className="text-[#FF6B6B]">"core-engine"</span>)
    
    <span className="text-[#BF5AF2]">if</span> repo.status == <span className="text-[#FF6B6B]">"ready"</span>:
        deployment = <span className="text-[#BF5AF2]">await</span> repo.deploy(
            environment=<span className="text-[#FF6B6B]">"production"</span>,
            strategy=<span className="text-[#FF6B6B]">"blue-green"</span>
        )
        <span className="text-[#0A84FF]">print</span>(<span className="text-[#FF6B6B]">f"✅ Live at: </span><span className="text-[#64D2FF]">&#123;</span>deployment.url<span className="text-[#64D2FF]">&#125;</span><span className="text-[#FF6B6B]">"</span>)

<span className="text-[#BF5AF2]">if</span> __name__ == <span className="text-[#FF6B6B]">"__main__"</span>:
    asyncio.run(deploy_next_gen_app())</code></pre>
          </div>
        </div>
      </motion.section>

      {/* Feature Cards */}
      <motion.section 
        initial={{ opacity: 0, y: 60 }} 
        whileInView={{ opacity: 1, y: 0 }} 
        viewport={{ once: true, margin: "-120px" }} 
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} 
        className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 px-4 sm:px-6 mb-28 relative z-10"
      >
        {[
          { icon: 'rate_review', title: 'Code Review', desc: 'Frictionless inline commenting and AI-assisted PR summaries built right into the editor.', color: '#0A84FF' },
          { icon: 'rocket_launch', title: 'CI/CD Pipelines', desc: 'Integrated workflows that build, test, and deploy faster than ever with smart caching.', color: '#BF5AF2' },
          { icon: 'bug_report', title: 'Issue Tracking', desc: 'Powerful boards and sprint planning tools that map directly to your commits and branches.', color: '#30D158' },
        ].map(({ icon, title, desc, color }) => (
          <TiltCard key={title} className="glass-panel p-8 rounded-2xl flex flex-col gap-4 group cursor-default transition-all duration-300 hover:shadow-lg">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
              style={{ background: `${color}15`, color, boxShadow: `0 0 0 1px ${color}22` }}>
              <span className="material-symbols-outlined" style={{fontVariationSettings: '"FILL" 1'}}>{icon}</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface font-headline transition-colors duration-200" onMouseEnter={e => (e.currentTarget.style.color = color)} onMouseLeave={e => (e.currentTarget.style.color = '')}>{title}</h3>
            <p className="text-on-surface-variant leading-relaxed">{desc}</p>
          </TiltCard>
        ))}
      </motion.section>

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

      {/* Settings toggle */}
      <Settings />
    </main>
  );
}