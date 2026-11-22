"use client";

import Link from "next/link";
import { useEffect } from "react";
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
      <div className="phx-cinema" aria-hidden="true">
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
                  <div><small>REPOSITORIES</small><b>Manage</b></div>
                  <div><small>ISSUES</small><b>Track</b></div>
                  <div><small>DELIVERY</small><b>Ship</b></div>
                </div>
              </div>
            </div>
          </div>
          <div className="phx-chip chip-a"><Search size={14}/><div><small>DISCOVERY</small><b>Find what matters</b></div></div>
          <div className="phx-chip chip-b"><Boxes size={14}/><div><small>DELIVERY</small><b>Release workflows</b></div></div>
        </div>

        <div className="phx-scroll">SCROLL TO EXPLORE PANDAHUB <ArrowDownRight size={15}/></div>
        {/* Scroll‑triggered demo */}
        <section className="phx-demo-section phx-content-reveal">
          <div className="demo-box" />
        </section>
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
          <p>Thoughtful transitions, clear focus states and subtle depth guide attention without slowing down your workspace.</p>
        </div>
      </section>

      <section className="phx-panel-section third">
        <div className="phx-panel-copy phx-content-reveal">
          <div className="phx-number">03</div>
          <div className="phx-kicker">SIGNAL OVER NOISE</div>
          <h2>Premium feels <i>quiet.</i></h2>
          <p>Soft sky and lavender, crisp borders, measured typography and restrained motion. No visual noise required.</p>
          <Link href="/dashboard" className="phx-inline">Open workspace <ArrowRight size={16}/></Link>
        </div>
        <div className="phx-terminal">
          <div className="terminal-head"><span><Terminal size={14}/> workflow</span><em>OVERVIEW</em></div>
          <pre>{`1. Create or connect a repository
2. Collaborate on issues and pull requests
3. Review code changes
4. Manage your delivery workflow`}</pre>
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