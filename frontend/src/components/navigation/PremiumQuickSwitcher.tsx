"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown, ArrowRight, ArrowUp, Code2, Compass, Home,
  Plus, Rocket, Search, Settings2, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const destinations: ReadonlyArray<{ label: string; subtitle: string; href: string; icon: LucideIcon; keywords: string }> = [
  { label: "Dashboard", subtitle: "Your workspace overview", href: "/dashboard", icon: Home, keywords: "home activity repositories" },
  { label: "Explore", subtitle: "Find repositories and people", href: "/explore", icon: Compass, keywords: "search discover users" },
  { label: "Code analysis", subtitle: "Review code with AI", href: "/code-analysis", icon: Code2, keywords: "editor analyze ai" },
  { label: "Startup hub", subtitle: "Discover teams and ideas", href: "/startups", icon: Rocket, keywords: "startups projects" },
  { label: "Create repository", subtitle: "Start something new", href: "/new", icon: Plus, keywords: "new repo git" },
  { label: "Settings", subtitle: "Profile and preferences", href: "/settings", icon: Settings2, keywords: "account security profile" },
];

export default function PremiumQuickSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const results = useMemo(() => {
    const term = query.toLocaleLowerCase().trim();
    return term
      ? destinations.filter((item) => `${item.label} ${item.subtitle} ${item.keywords}`.toLocaleLowerCase().includes(term))
      : destinations;
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = oldOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  const navigate = (href: string) => {
    onClose();
    router.push(href);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key === "ArrowDown" && results.length > 0) { event.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    if (event.key === "Enter" && event.target === inputRef.current && results[activeIndex]) { event.preventDefault(); navigate(results[activeIndex].href); }
    if (event.key === "Tab") {
      const controls = panelRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), a[href]");
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };

  if (!open) return null;

  return (
    <div className="ph-quick-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ph-quick-title"
        aria-describedby="ph-quick-description"
        className="ph-quick-dialog"
        onKeyDown={handleKeyDown}
      >
        <div className="ph-quick-dialog-top">
          <div><span className="ph-quick-eyebrow">PANDAHUB / SHORTCUTS</span><h2 id="ph-quick-title">Where to next?</h2></div>
          <button type="button" aria-label="Close quick switcher" className="ph-quick-close" onClick={onClose}><X size={18} /></button>
        </div>
        <p id="ph-quick-description" className="ph-quick-description">Jump to your tools without losing momentum.</p>
        <label className="ph-quick-search">
          <Search size={19} aria-hidden="true" />
          <span className="sr-only">Search pages</span>
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages and actions…" autoComplete="off" />
          <kbd>ESC</kbd>
        </label>
        <div className="ph-quick-options" role="listbox" aria-label="Pages and actions">
          {results.length ? results.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                className={`ph-quick-option ${activeIndex === index ? "ph-quick-option-active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => navigate(item.href)}
              >
                <span className="ph-quick-option-icon"><Icon size={19} strokeWidth={2} /></span>
                <span className="ph-quick-option-text"><strong>{item.label}</strong><small>{item.subtitle}</small></span>
                <ArrowRight className="ph-quick-option-arrow" size={17} aria-hidden="true" />
              </button>
            );
          }) : <div className="ph-quick-empty">No matching pages. Try “repository” or “settings”.</div>}
        </div>
        <div className="ph-quick-footer">
          <span><ArrowUp size={13} /><ArrowDown size={13} /> Navigate</span>
          <span><kbd>↵</kbd> Open</span>
          <span><kbd>Alt K</kbd> or <kbd>Ctrl K</kbd> Quick switch</span>
        </div>
      </div>
    </div>
  );
}
