"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import MotionDetectiveBackground from "@/components/MotionDetectiveBackground";
import {
  ArrowDownRight,
  ArrowRight,
  Boxes,
  GitBranch,
  Github,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";

export default function HomePage() {
  const frame = useRef<number | null>(null);
  const cinemaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cinema = cinemaRef.current;
    if (!cinema) return;

    // Grab all animated elements ONCE — no repeated DOM queries during scroll
    const camera    = cinema.querySelector<HTMLElement>(".phx-camera");
    const beamA     = cinema.querySelector<HTMLElement>(".phx-beam-a");
    const beamB     = cinema.querySelector<HTMLElement>(".phx-beam-b");
    const beamC     = cinema.querySelector<HTMLElement>(".phx-beam-c");
    const f1        = cinema.querySelector<HTMLElement>(".f1");
    const f2        = cinema.querySelector<HTMLElement>(".f2");
    const f3        = cinema.querySelector<HTMLElement>(".f3");
    const f4        = cinema.querySelector<HTMLElement>(".f4");
    const f5        = cinema.querySelector<HTMLElement>(".f5");
    const f6        = cinema.querySelector<HTMLElement>(".f6");
    const r1        = cinema.querySelector<HTMLElement>(".r1");
    const r2        = cinema.querySelector<HTMLElement>(".r2");
    const r3        = cinema.querySelector<HTMLElement>(".r3");
    const slabA     = cinema.querySelector<HTMLElement>(".slab-a");
    const slabB     = cinema.querySelector<HTMLElement>(".slab-b");
    const slabC     = cinema.querySelector<HTMLElement>(".slab-c");
    const gridfloor = cinema.querySelector<HTMLElement>(".phx-gridfloor");
    const s1        = cinema.querySelector<HTMLElement>(".s1");
    const s2        = cinema.querySelector<HTMLElement>(".s2");
    const s3        = cinema.querySelector<HTMLElement>(".s3");
    const scan      = cinema.querySelector<HTMLElement>(".phx-scan");

    // Elements outside the cinema div
    const progressBar  = document.querySelector<HTMLElement>(".phx-progress");
    const consoleBack  = document.querySelector<HTMLElement>(".phx-console-back");
    const consoleMain  = document.querySelector<HTMLElement>(".phx-console-main");
    const chipA        = document.querySelector<HTMLElement>(".chip-a");
    const chipB        = document.querySelector<HTMLElement>(".chip-b");
    const layerCard    = document.querySelector<HTMLElement>(".phx-layer-card");
    const core         = document.querySelector<HTMLElement>(".core");
    const o1           = document.querySelector<HTMLElement>(".o1");
    const o2           = document.querySelector<HTMLElement>(".o2");
    const o3           = document.querySelector<HTMLElement>(".o3");
    const terminal     = document.querySelector<HTMLElement>(".phx-terminal");

    let lastY = window.scrollY;
    let lastT = performance.now();
    let maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

    const updateMaxScroll = () => {
      maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    };

    // Inline style.transform = directly targets the compositor — no style recalc, no layout
    const st = (el: HTMLElement | null, v: string) => { if (el) el.style.transform = v; };

    const paint = () => {
      frame.current = null;
      const y   = window.scrollY;
      const p   = Math.max(0, Math.min(1, y / maxScroll)); // 0 → 1
      const now = performance.now();
      const vel = Math.max(-3, Math.min(3, ((y - lastY) / Math.max(16, now - lastT)) * 16));
      lastY = y;
      lastT = now;

      // ── Camera ──
      st(camera, `translate3d(${p*18}px,${p*-85}px,0) scale(${1+p*.09}) rotateX(${p*4}deg)`);

      // ── Beams ──
      st(beamA, `translate3d(${p*480}px,0,-280px) rotate(12deg)`);
      st(beamB, `translate3d(${p*-280}px,0,-360px) rotate(-9deg)`);
      st(beamC, `translate3d(${p*-430}px,0,-420px) rotate(-15deg)`);

      // ── Tunnel frames ──
      st(f1, `translate3d(${p*-80}px,${p*130}px,0) rotateX(64deg) scale(.96)`);
      st(f2, `translate3d(${p*100}px,${p*-95}px,-130px) rotateX(64deg) scale(.81)`);
      st(f3, `translate3d(${p*-120}px,${p*70}px,-250px) rotateX(64deg) scale(.67)`);
      st(f4, `translate3d(${p*150}px,${p*-120}px,-380px) rotateX(64deg) scale(.54)`);
      st(f5, `translate3d(${p*-185}px,${p*90}px,-530px) rotateX(64deg) scale(.42)`);
      st(f6, `translate3d(${p*220}px,${p*-80}px,-700px) rotateX(64deg) scale(.32)`);

      // ── Rings ──
      st(r1, `translate3d(${p*-170}px,${p*130}px,260px) rotateX(68deg) rotateZ(${p*105}deg)`);
      st(r2, `translate3d(${p*170}px,${p*-110}px,140px) rotateY(72deg) rotateZ(${p*-85}deg)`);
      st(r3, `translate3d(${p*30}px,${p*140}px,340px) rotateY(70deg) rotateZ(${p*65}deg)`);

      // ── Slabs ──
      st(slabA, `translate3d(${p*220}px,${p*-100}px,420px) rotateX(${p*-18+8}deg) rotateY(${p*30-18}deg) rotateZ(${p*-8}deg)`);
      st(slabB, `translate3d(${p*-270}px,${p*170}px,-150px) rotateX(${p*14-8}deg) rotateY(${p*-35-18}deg) rotateZ(${p*5}deg)`);
      st(slabC, `translate3d(${p*290}px,${p*90}px,320px) rotateX(${p*24}deg) rotateY(${p*52}deg) rotateZ(${p*-10}deg)`);

      // ── Gridfloor ──
      st(gridfloor, `perspective(900px) rotateX(68deg) translate3d(0,${p*300}px,-180px) scale(1.3)`);

      // ── Streaks ──
      st(s1, `translate3d(${p*320}px,${p*180}px,0) rotate(-13deg)`);
      st(s2, `translate3d(${p*-360}px,${p*-100}px,0) rotate(11deg)`);
      st(s3, `translate3d(${p*170}px,${p*-210}px,0) rotate(-4deg)`);

      // ── Scan line ──
      st(scan, `translate3d(0,${p*520-240}px,0)`);

      // ── Progress bar — scaleX avoids width layout recalc ──
      if (progressBar) progressBar.style.transform = `scaleX(${p})`;

      // ── Console 3D panels ──
      st(consoleBack, `translate3d(${p*-180}px,${p*220}px,-240px) rotateX(${p*17-12}deg) rotateY(${p*-24-18}deg) rotateZ(${p*5-3}deg)`);
      st(consoleMain, `translate3d(${p*80}px,${p*190}px,${p*290}px) rotateX(${p*-16+5}deg) rotateY(${p*18-14}deg) rotateZ(${p*-4+1}deg)`);

      // ── Chips ──
      st(chipA, `translate3d(${p*-270}px,${p*170}px,450px) rotateX(${p*23-13}deg) rotateY(${p*-28-5}deg) rotateZ(${p*4}deg)`);
      st(chipB, `translate3d(${p*240}px,${p*-190}px,530px) rotateX(${p*-15+11}deg) rotateY(${p*30+4}deg) rotateZ(${p*-5}deg)`);

      // ── Layer card ──
      st(layerCard, `translate3d(${p*190}px,${p*-120}px,190px) rotateX(${p*13+7}deg) rotateY(${p*-30+13}deg)`);

      // ── Orb ── (Optimized stable 3D rotation, avoiding 90deg matrix singularities)
      st(core,      `translate3d(${p*-80}px,${p*90}px,140px) rotateX(${p*32+14}deg) rotateY(${p*-36+14}deg)`);
      st(o1,        `translate3d(${p*90}px,${p*-60}px,90px) rotateX(65deg) rotateZ(${p*50}deg)`);
      st(o2,        `translate3d(${p*-90}px,${p*70}px,120px) rotateY(65deg) rotateZ(${p*-40}deg)`);
      st(o3,        `translate3d(${p*40}px,${p*40}px,-30px) rotateX(55deg) rotateZ(${p*30}deg)`);

      // Terminal
      st(terminal, `translate3d(${p*150}px,${p*-180}px,360px) rotateX(${p*14+8}deg) rotateY(${p*25-12}deg) rotateZ(${p*-4}deg)`);
    };

    const schedule = () => {
      if (frame.current === null) frame.current = requestAnimationFrame(paint);
    };

    const handleResize = () => { updateMaxScroll(); schedule(); };

    const ro = new ResizeObserver(() => { updateMaxScroll(); schedule(); });
    ro.observe(document.body);

    paint();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", handleResize);
      ro.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>(".phx-content-reveal");
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((n) => n.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("is-visible")),
      { threshold: 0.16, rootMargin: "0px 0px -10% 0px" }
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="phx-page">
      <MotionDetectiveBackground />
      <div className="phx-cinema" aria-hidden="true" ref={cinemaRef}>
        <div className="phx-camera">
          <div className="phx-ambient" />
          <div className="phx-beam phx-beam-a" />
          <div className="phx-beam phx-beam-b" />
          <div className="phx-beam phx-beam-c" />
          <div className="phx-tunnel">
            <div className="phx-frame3d f1" />
            <div className="phx-frame3d f2" />
            <div className="phx-frame3d f3" />
            <div className="phx-frame3d f4" />
            <div className="phx-frame3d f5" />
            <div className="phx-frame3d f6" />
          </div>
          <div className="phx-ring r1" />
          <div className="phx-ring r2" />
          <div className="phx-ring r3" />
          <div className="phx-slab slab-a" />
          <div className="phx-slab slab-b" />
          <div className="phx-slab slab-c" />
          <div className="phx-gridfloor" />
          <div className="phx-streak s1" />
          <div className="phx-streak s2" />
          <div className="phx-streak s3" />
          <div className="phx-particles">
            {Array.from({ length: 14 }).map((_, i) => (
              <i key={i} style={{ animationDelay: `${-i * 0.55}s` }} />
            ))}
          </div>
        </div>
        <div className="phx-scan" />
        <div className="phx-vignette" />
        <div className="phx-grain" />
        <div className="phx-letterbox top" />
        <div className="phx-letterbox bottom" />
      </div>

      <div className="phx-progress" aria-hidden="true" />

      <nav className="phx-nav">
        <Link href="/" className="phx-brand">
          <span className="phx-brand-icon">P</span><span>PANDAHUB</span>
        </Link>
        <div className="phx-nav-links">
          <Link href="/explore">Explore</Link>
          <Link href="/startups">Startups</Link>
          <Link href="/dashboard">Workspace</Link>
        </div>
        <div className="phx-nav-actions">
          <Link href="/login" className="phx-login">Sign in</Link>
          <Link href="/register" className="phx-nav-cta">Start building</Link>
        </div>
      </nav>

      <section className="phx-hero">
        <div className="phx-hero-copy phx-content-reveal">
          <div className="phx-kicker"><Sparkles size={14} /> PANDAHUB / MOTION SYSTEM</div>
          <h1>Build in <i>motion.</i><br />Ship with <i>clarity.</i></h1>
          <p>PandaHub is a source-control and collaboration workspace designed as a continuous premium experience.</p>
          <div className="phx-actions">
            <Link href="/register" className="phx-primary">Create workspace <ArrowRight size={17} /></Link>
            <Link href="/explore" className="phx-secondary">Explore PandaHub</Link>
          </div>
          <div className="phx-proof">
            <span><GitBranch size={13}/> Git native</span>
            <span><ShieldCheck size={13}/> Team ready</span>
            <span><Zap size={13}/> Fast by design</span>
          </div>
        </div>

        <div className="phx-console" aria-hidden="true">
          <div className="phx-console-back">
            <small>PROJECT MAP</small><strong>PANDAHUB</strong>
            <div className="line" /><div className="line short" /><div className="line" />
            <div className="tree">core/<br />&nbsp;&nbsp;workspace/<br />&nbsp;&nbsp;product/<br />&nbsp;&nbsp;infra/</div>
          </div>
          <div className="phx-console-main">
            <div className="windowbar"><span/><span/><span/><b>PANDAHUB / WORKSPACE</b></div>
            <div className="windowbody">
              <aside>
                <small>WORKSPACE</small><strong>Mission control</strong>
                <div className="active">Overview</div>
                <div>Repositories</div><div>Issues</div><div>Activity</div><div>Deployments</div>
              </aside>
              <div className="consolecontent">
                <small className="consolelabel">OPERATING SYSTEM FOR BUILDERS</small>
                <h2>Build / review / ship</h2>
                <div className="stats">
                  <div><small>REPOSITORIES</small><b>24</b></div>
                  <div><small>ISSUES</small><b>08</b></div>
                  <div><small>DEPLOYS</small><b>46</b></div>
                </div>
                <div className="codebox">
                  <div><Terminal size={13}/> production.log</div>
                  <code>
                    <span>$</span> panda inspect workspace<br/>
                    <span>+</span> checks passed<br/>
                    <span>+</span> branch synchronized<br/>
                    <span>+</span> deployment ready
                  </code>
                </div>
              </div>
            </div>
          </div>
          <div className="phx-chip chip-a"><Search size={14}/><div><small>DISCOVERY</small><b>Find what matters</b></div></div>
          <div className="phx-chip chip-b"><Boxes size={14}/><div><small>DELIVERY</small><b>46 releases tracked</b></div></div>
        </div>

        <div className="phx-scroll">SCROLL TO MOVE THE CAMERA <ArrowDownRight size={15}/></div>
      </section>

      <section className="phx-panel-section">
        <div className="phx-panel-copy phx-content-reveal">
          <div className="phx-number">01</div>
          <div className="phx-kicker">THE WORKSPACE</div>
          <h2>The screen is only the <i>surface.</i></h2>
          <p>Scroll deeper and the interface opens into layers. Repository context, reviews, activity and shipping signals move at different depths.</p>
        </div>
        <div className="phx-layer-card layer-card-a">
          <Layers3 size={14}/><small>CONNECTED WORKSPACE</small><strong>One system. Many signals.</strong>
          <div className="mini-bars"><i/><i/><i/><i/><i/></div>
        </div>
      </section>

      <section className="phx-panel-section second">
        <div className="phx-orb-scene">
          <div className="core"><span>PANDA</span><b>HUB</b></div>
          <div className="orb-ring o1"/>
          <div className="orb-ring o2"/>
          <div className="orb-ring o3"/>
        </div>
        <div className="phx-panel-copy phx-content-reveal">
          <div className="phx-number">02</div>
          <div className="phx-kicker">MOTION ENGINE</div>
          <h2>Movement with <i>intent.</i></h2>
          <p>The camera, rings, light field and depth planes react to scroll progress, creating the feeling of travelling through a living product environment.</p>
        </div>
      </section>

      <section className="phx-panel-section third">
        <div className="phx-panel-copy phx-content-reveal">
          <div className="phx-number">03</div>
          <div className="phx-kicker">SIGNAL OVER NOISE</div>
          <h2>Premium feels <i>quiet.</i></h2>
          <p>Pure monochrome, crisp borders, measured typography and restrained motion. No neon required.</p>
          <Link href="/dashboard" className="phx-inline">Open workspace <ArrowRight size={16}/></Link>
        </div>
        <div className="phx-terminal">
          <div className="terminal-head"><span><Terminal size={14}/> terminal</span><em>LIVE</em></div>
          <pre>{`$ panda connect\n> repository linked\n> review queue synchronized\n> deployment pipeline ready\n\n$ panda ship --prod\n> checks passed\n> production updated`}</pre>
        </div>
      </section>

      <section className="phx-end">
        <div className="phx-end-copy phx-content-reveal">
          <div className="phx-kicker">04 / ENTER THE SYSTEM</div>
          <h2>Make the next <i>commit matter.</i></h2>
          <Link href="/register" className="phx-primary large">Create your workspace <ArrowRight size={18}/></Link>
        </div>
      </section>

      <footer className="phx-footer">
        <span>PANDAHUB</span>
        <div>
          <Link href="/explore">Explore</Link>
          <Link href="/startups">Startups</Link>
          <Link href="/login">Sign in</Link>
        </div>
        <Github size={15}/>
      </footer>
    </main>
  );
}