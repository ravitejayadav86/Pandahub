"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import PandaHubSidebar from "./PandaHubSidebar";
import PremiumQuickSwitcher from "./PremiumQuickSwitcher";

const HIDDEN_PREFIXES = [
  "/login",
  "/register",
  "/reset-password",
  "/oauth",
  "/onboarding",
  "/forbidden",
];

export default function GlobalNavigationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  // Keep the dock narrow while browsing. Hover or keyboard focus previews the full menu.
  const [railExpanded, setRailExpanded] = useState(false);
  const [hoverLocked, setHoverLocked] = useState(false);
  const pointerInsideRail = useRef(false);
  const showNavigation = pathname !== "/" && !HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  // One keyboard shortcut for the entire authenticated workspace. No scroll listeners.
  useEffect(() => {
    if (!showNavigation) return;
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.altKey || event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setQuickSwitcherOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [showNavigation]);

  // The Next.js layout persists across navigation, so close transient UI on route changes.
  useEffect(() => {
    setQuickSwitcherOpen(false);
    setRailExpanded(false);
    // When navigation happens under the cursor, do not immediately reopen
    // the dock until the pointer has left and entered it again.
    setHoverLocked(pointerInsideRail.current);
  }, [pathname]);

  const collapseOnNavigation = () => {
    setRailExpanded(false);
    setHoverLocked(pointerInsideRail.current);
  };

  const segment = pathname.split('/').filter(Boolean)[0] || 'home';
  const section = ['dashboard', 'explore', 'code-analysis', 'startups', 'settings', 'admin', 'new'].includes(segment)
    ? segment
    : 'repository';

  return (
    <div className="ph-app-shell" data-ph-rail={showNavigation ? (railExpanded ? "expanded" : "compact") : undefined}>
      {showNavigation && (
        <PandaHubSidebar
          expanded={railExpanded}
          onPointerEnterRail={() => {
            pointerInsideRail.current = true;
            if (!hoverLocked) setRailExpanded(true);
          }}
          onPointerLeaveRail={() => {
            pointerInsideRail.current = false;
            setHoverLocked(false);
            setRailExpanded(false);
          }}
          onFocusRail={() => setRailExpanded(true)}
          onToggleRail={() => {
            setRailExpanded((value) => !value);
            setHoverLocked(false);
          }}
          onNavigate={collapseOnNavigation}
          onOpenQuickSwitcher={() => {
            setQuickSwitcherOpen(true);
            collapseOnNavigation();
          }}
        />
      )}
      <div
        className={showNavigation ? "ph-app-content ph-premium-content" : "ph-app-content ph-app-content-public"}
        data-ph-section={showNavigation ? section : undefined}
      >
        {children}
      </div>
      {showNavigation && (
        <PremiumQuickSwitcher open={quickSwitcherOpen} onClose={() => setQuickSwitcherOpen(false)} />
      )}
    </div>
  );
}
