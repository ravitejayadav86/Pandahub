"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  BookOpen,
  Code2,
  Compass,
  FileText,
  Folder,
  Users,
  UserPlus,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Home,
  LayoutDashboard,
  Plus,
  Rocket,
  Settings,
  ShieldCheck,
  Upload,
  UserRound,
  CircleDot,
  Command,
  Search,
  ChevronsRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import api from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import type { Repository } from "@/types";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

type RepoContext = {
  owner: string;
  name: string;
};

const RESERVED_ROOTS = new Set([
  "dashboard",
  "explore",
  "new",
  "startups",
  "code-analysis",
  "settings",
  "admin",
  "login",
  "register",
  "reset-password",
  "onboarding",
  "oauth",
  "forbidden",
  "design-system",
]);

function isPathActive(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  compact = false,
  profile = false,
  collapsed = false,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  compact?: boolean;
  profile?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const active = isPathActive(pathname, item.href, item.exact || profile);
  const Icon = item.icon;

  return (
    <motion.div
      whileHover={compact ? { y: -3, scale: 1.035 } : collapsed ? { scale: 1.07 } : { x: 3 }}
      whileTap={{ scale: 0.975 }}
      transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.45 }}
      className={compact ? "ph-mobile-item-wrap" : "ph-nav-item-wrap"}
    >
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        title={compact || collapsed ? item.label : undefined}
        aria-label={item.label}
        onClick={onNavigate}
        className={`${compact ? "ph-mobile-nav-link" : "ph-nav-link"} ${active ? "ph-nav-link-active" : ""} ${compact && item.label === "Create repository" ? "ph-mobile-create" : ""}`}
      >
        {active && <motion.span layoutId={compact ? 'pandahub-active-mobile' : 'pandahub-active-desktop'} className="ph-nav-active-bg" transition={{ type: "spring", stiffness: 360, damping: 32 }} />}
        <Icon className="ph-nav-icon" size={compact ? 19 : 18} strokeWidth={active ? 2.35 : 1.9} />
        <span className="ph-nav-label">{item.label}</span>
      </Link>
    </motion.div>
  );
}

type SidebarProps = {
  expanded: boolean;
  onPointerEnterRail: () => void;
  onPointerLeaveRail: () => void;
  onFocusRail: () => void;
  onToggleRail: () => void;
  onNavigate: () => void;
  onOpenQuickSwitcher: () => void;
};

export default function PandaHubSidebar({
  expanded, onPointerEnterRail, onPointerLeaveRail,
  onFocusRail, onToggleRail, onNavigate, onOpenQuickSwitcher,
}: SidebarProps) {
  const pathname = usePathname() || "/dashboard";
  const user = useAuthStore((state) => state.user);
  const [firstRepo, setFirstRepo] = useState<Repository | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!getAccessToken()) return () => { cancelled = true; };

    api
      .get<Repository[]>("/auth/me/repos", { params: { limit: 1 } })
      .then(({ data }) => {
        if (!cancelled) setFirstRepo(Array.isArray(data) ? data[0] ?? null : null);
      })
      .catch(() => {
        if (!cancelled) setFirstRepo(null);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const repoContext = useMemo<RepoContext | null>(() => {
    const parts = pathname.split("/").filter(Boolean);
    const first = parts[0] || "";
    const second = parts[1] || "";
    const isRepoRoute = parts.length >= 2 && !RESERVED_ROOTS.has(first) && !["followers", "following"].includes(second);

    if (isRepoRoute) return { owner: first, name: second };
    if (firstRepo?.name) {
      return {
        owner: firstRepo.owner_username || user?.username || "",
        name: firstRepo.name,
      };
    }
    return null;
  }, [pathname, firstRepo, user?.username]);

  const primaryItems: NavItem[] = [
    { label: "Home", href: "/dashboard", icon: Home, exact: true },
    { label: "Explore", href: "/explore", icon: Compass },
    { label: "Code analysis", href: "/code-analysis", icon: Code2 },
    { label: "Startup hub", href: "/startups", icon: Rocket },
  ];

  const repoBase = repoContext?.owner && repoContext?.name
    ? `/${repoContext.owner}/${repoContext.name}`
    : null;

  const repoItems: NavItem[] = repoBase
    ? [
        { label: "Files", href: `${repoBase}/tree`, icon: Folder },
        { label: "Issues", href: `${repoBase}/issues`, icon: CircleDot },
        { label: "Pull requests", href: `${repoBase}/pulls`, icon: GitPullRequest },
        { label: "Commits", href: `${repoBase}/commits`, icon: GitCommitHorizontal },
        { label: "Pages", href: `${repoBase}/pages`, icon: BookOpen },
        { label: "Security", href: `${repoBase}/security`, icon: ShieldCheck },
        { label: "Upload files", href: `${repoBase}/upload`, icon: Upload },
      ]
    : [];

  const accountItems: NavItem[] = [
    ...(user?.username
      ? [
          { label: "Profile", href: `/${user.username}`, icon: UserRound, exact: true },
          { label: "Followers", href: `/${user.username}/followers`, icon: Users },
          { label: "Following", href: `/${user.username}/following`, icon: UserPlus },
        ]
      : []),
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  const createItem: NavItem = { label: "Create repository", href: "/new", icon: Plus, exact: true };
  const mobileItems = [...primaryItems, createItem, ...repoItems, ...accountItems];

  return (
    <>
      <aside
        className="ph-left-rail"
        aria-label="PandaHub main navigation"
        data-expanded={expanded}
        onMouseEnter={onPointerEnterRail}
        onMouseLeave={onPointerLeaveRail}
        onFocusCapture={(event) => {
          if (!(event.target as HTMLElement).closest('.ph-rail-toggle')) onFocusRail();
        }}
      >
        <div className="ph-rail-brand">
          <motion.div whileHover={{ rotate: -7, scale: 1.07 }} transition={{ type: "spring", stiffness: 380, damping: 18 }} className="ph-brand-mark" aria-hidden="true">
            🐼
          </motion.div>
          <div className="ph-brand-copy">
            <span className="ph-brand-name">PandaHub</span>
            <span className="ph-brand-caption">Developer workspace</span>
          </div>
          <button
            type="button"
            className="ph-rail-toggle"
            onClick={onToggleRail}
            aria-expanded={expanded}
            aria-label={expanded ? "Minimize navigation" : "Expand navigation"}
            aria-controls="ph-sidebar-navigation"
            title={expanded ? "Minimize sidebar" : "Expand sidebar"}
          >
            <motion.span
              className="ph-rail-toggle-symbol"
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 22 }}
            ><ChevronsRight size={17} strokeWidth={2.1} /></motion.span>
          </button>
        </div>

        <div className="ph-rail-scroll" id="ph-sidebar-navigation">
          <button
            type="button"
            className="ph-quick-trigger"
            onClick={onOpenQuickSwitcher}
            aria-label="Open PandaHub quick switcher, Alt K"
          >
            <span className="ph-quick-trigger-icon"><Search size={15} strokeWidth={2.1} /></span>
            <span className="ph-quick-trigger-label">Jump anywhere</span>
            <kbd>Alt K</kbd>
          </button>
          <div className="ph-nav-section">
            <p className="ph-nav-section-title">Workspace</p>
            {primaryItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} collapsed={!expanded} onNavigate={onNavigate} />
            ))}
          </div>

          <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }} transition={{ type: "spring", stiffness: 420, damping: 26 }}>
            <Link href="/new" className="ph-create-link" onClick={onNavigate} aria-label="Create repository" title={!expanded ? "Create repository" : undefined}>
              <span className="ph-create-icon"><Plus size={18} strokeWidth={2.7} /></span>
              <span>Create</span>
              <span className="ph-create-spark" aria-hidden="true">✦</span>
            </Link>
          </motion.div>

          {repoItems.length > 0 && (
            <div className="ph-nav-section ph-repo-section">
              <p className="ph-nav-section-title">Repository</p>
              <div className="ph-repo-caption" title={`${repoContext?.owner}/${repoContext?.name}`}>
                <GitBranch size={12} />
                <span>{repoContext?.name}</span>
              </div>
              {repoItems.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} collapsed={!expanded} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>

        <div className="ph-rail-footer">
          <div className="ph-rail-divider" />
          {accountItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} profile={item.label === "Profile"} collapsed={!expanded} onNavigate={onNavigate} />
          ))}
          <div className="ph-rail-footnote"><Activity size={12} /> Built for builders</div>
        </div>
      </aside>

      <nav className="ph-mobile-dock" aria-label="PandaHub mobile navigation">
        <button type="button" className="ph-mobile-quick-trigger" onClick={onOpenQuickSwitcher} aria-label="Open quick switcher">
          <Command size={19} strokeWidth={2} aria-hidden="true" />
          <span>Jump</span>
        </button>
        {mobileItems.map((item) => (
          <NavLink key={`${item.label}-${item.href}`} item={item} pathname={pathname} compact profile={item.label === "Profile"} onNavigate={onNavigate} />
        ))}
      </nav>
    </>
  );
}
