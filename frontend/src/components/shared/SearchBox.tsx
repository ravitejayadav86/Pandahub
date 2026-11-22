'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { Repository, User } from '@/types';
import { 
  Search, X, Compass, Rocket, Plus, Settings, 
  FolderGit2, CornerDownLeft, Loader2, Star
} from 'lucide-react';

interface SearchBoxProps {
  placeholder?: string;
  maxWidth?: number;
  expandedMaxWidth?: number;
  triggerSlash?: boolean;
}

export default function SearchBox({
  placeholder = 'Search repositories, users, explore...',
  maxWidth = 390,
  expandedMaxWidth = 520,
  triggerSlash = true,
}: SearchBoxProps) {
  const { user } = useAuthStore();
  const router = useRouter();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [repoResults, setRepoResults] = useState<Repository[]>([]);
  const [userResults, setUserResults] = useState<Partial<User>[]>([]);
  const [isMac, setIsMac] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Detect OS for Mac vs Windows keyboard shortcut */
  useEffect(() => {
    setIsMac(typeof window !== 'undefined' && navigator.userAgent.toUpperCase().indexOf('MAC') >= 0);
  }, []);

  /* Global keyboard shortcut: Ctrl+K / Cmd+K (and optionally '/') to open search */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in another input / textarea
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea' || (e.target as HTMLElement)?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        inputRef.current?.focus();
        return;
      }

      if (triggerSlash && e.key === '/' && !isInput && !(e.ctrlKey || e.metaKey || e.altKey)) {
        e.preventDefault();
        setSearchOpen(true);
        inputRef.current?.focus();
        return;
      }

      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, triggerSlash]);

  /* Close search panel on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    if (searchOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  /* Live debounced search across repos and users */
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setRepoResults([]);
      setUserResults([]);
      setIsSearching(false);
      return;
    }

    // PANDAHUB_UI_SEARCH_RACE_FIX: cancel old queries and ignore outdated responses.
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setIsSearching(true);
      try {
        const [reposRes, usersRes] = await Promise.all([
          api.get<Repository[]>('/explore/repos', { params: { q: trimmed, limit: 5 }, signal: controller.signal }),
          api.get<Partial<User>[]>('/auth/explore/users', { params: { q: trimmed, limit: 5 }, signal: controller.signal }),
        ]);
        if (cancelled) return;
        setRepoResults(reposRes.data || []);
        setUserResults(usersRes.data || []);
      } catch {
        if (!cancelled) { setRepoResults([]); setUserResults([]); }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [searchQuery]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        maxWidth: maxWidth,
        position: 'relative',
        transition: 'max-width 0.25s cubic-bezier(0.22,1,0.36,1)',
        ...(searchOpen && { maxWidth: expandedMaxWidth }),
      }}
    >
      <form onSubmit={handleSearchSubmit} style={{ position: 'relative', width: '100%' }}>
        <Search
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 16,
            height: 16,
            color: searchOpen ? '#66599F' : '#64748B',
            transition: 'color 0.2s ease',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!searchOpen) setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          placeholder={placeholder}
          style={{
            width: '100%',
            height: 36,
            paddingLeft: 38,
            paddingRight: searchQuery ? 74 : 58,
            border: `1.5px solid ${searchOpen ? 'rgba(128,111,194,0.48)' : 'rgba(107,126,174,0.28)'}`,
            borderRadius: 10,
            fontSize: 13,
            outline: 'none',
            background: searchOpen ? '#FBFBFB' : '#E8F9FF',
            color: '#1F2937',
            fontFamily: 'Space Grotesk, Inter, sans-serif',
            boxSizing: 'border-box',
            boxShadow: searchOpen
              ? '0 0 0 3px rgba(197,186,255,0.28), 0 4px 16px rgba(91,109,160,0.10)'
              : 'inset 0 1px 0 rgba(255,255,255,0.82)',
            transition: 'all 0.2s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 9,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 2,
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Clear query"
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          )}
          <kbd
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#94a3b8',
              background: 'rgba(196,217,255,0.30)',
              border: '1px solid rgba(107,126,174,0.24)',
              borderRadius: 5,
              padding: '2px 5px',
              letterSpacing: '0.02em',
              pointerEvents: 'none',
            }}
          >
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </div>
      </form>

      {/* ── Search Dropdown Panel ── */}
      {searchOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            background: '#E8F9FF',
            borderRadius: 14,
            border: '1px solid rgba(107, 126, 174, 0.24)',
            boxShadow: '0 18px 42px -8px rgba(91,109,160,0.16), 0 0 0 1px rgba(107,126,174,0.12)',
            zIndex: 1000,
            overflow: 'hidden',
            maxHeight: 460,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Quick Navigation when query is empty */}
          {!searchQuery.trim() && (
            <div style={{ padding: '8px 0' }}>
              <div
                style={{
                  padding: '6px 14px 4px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#71717a',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                Quick Navigation
              </div>

              {[
                { href: '/explore', icon: Compass, label: 'Explore Repositories', desc: 'Browse public codebases & community creations' },
                { href: '/startups', icon: Rocket, label: 'Startups Ecosystem', desc: 'Discover innovative ventures and projects' },
                { href: '/new', icon: Plus, label: 'New Repository', desc: 'Create a brand new Git repository' },
                ...(user ? [
                  { href: `/${user.username}`, icon: FolderGit2, label: 'My Repositories', desc: `View @${user.username}'s profile & projects` },
                  { href: '/settings', icon: Settings, label: 'Settings', desc: 'Manage profile, security, and access tokens' }
                ] : [])
              ].map((item, idx) => {
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={idx}
                    href={item.href}
                    onClick={() => setSearchOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      textDecoration: 'none',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: 'rgba(196,217,255,0.30)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#1F2937',
                        flexShrink: 0,
                      }}
                    >
                      <ItemIcon style={{ width: 16, height: 16 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1F2937' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 11, color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.desc}
                      </div>
                    </div>
                    <CornerDownLeft style={{ width: 13, height: 13, color: '#52525b', flexShrink: 0 }} />
                  </Link>
                );
              })}
            </div>
          )}

          {/* Results when user types */}
          {searchQuery.trim() && (
            <div style={{ overflowY: 'auto', maxHeight: 380, padding: '6px 0' }}>
              {isSearching ? (
                <div
                  style={{
                    padding: '28px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    color: '#a1a1aa',
                    fontSize: 13,
                  }}
                >
                  <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                  Searching PandaHub for &ldquo;{searchQuery}&rdquo;...
                </div>
              ) : (
                <>
                  {/* Repositories Section */}
                  {repoResults.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <div
                        style={{
                          padding: '6px 14px 4px',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#71717a',
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Repositories ({repoResults.length})
                      </div>
                      {repoResults.map((repo) => {
                        const owner = repo.owner_username || repo.slug?.split('/')[0] || 'community';
                        return (
                          <Link
                            key={repo.id}
                            href={`/${owner}/${repo.name}`}
                            onClick={() => setSearchOpen(false)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '9px 14px',
                              textDecoration: 'none',
                              transition: 'background 0.12s ease',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = 'transparent';
                            }}
                          >
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 7,
                                background: 'rgba(59, 130, 246, 0.12)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#60a5fa',
                                flexShrink: 0,
                              }}
                            >
                              <FolderGit2 style={{ width: 15, height: 15 }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#1F2937', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ color: '#a1a1aa' }}>{owner} /</span>
                                <span>{repo.name}</span>
                              </div>
                              {repo.description && (
                                <div style={{ fontSize: 11, color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {repo.description}
                                </div>
                              )}
                            </div>
                            {repo.star_count !== undefined && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#a1a1aa', flexShrink: 0 }}>
                                <Star style={{ width: 12, height: 12, fill: '#eab308', color: '#eab308' }} />
                                {repo.star_count}
                              </div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* Users & Organizations Section */}
                  {userResults.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <div
                        style={{
                          padding: '6px 14px 4px',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#71717a',
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Users & Organizations ({userResults.length})
                      </div>
                      {userResults.map((u) => (
                        <Link
                          key={u.id || u.username}
                          href={`/${u.username}`}
                          onClick={() => setSearchOpen(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '9px 14px',
                            textDecoration: 'none',
                            transition: 'background 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: '#C4D9FF',
                              border: '1px solid rgba(255,255,255,0.15)',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#1F2937' }}>
                                {u.username?.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1F2937' }}>
                              @{u.username}
                              {u.full_name && <span style={{ fontSize: 12, color: '#a1a1aa', marginLeft: 6, fontWeight: 400 }}>({u.full_name})</span>}
                            </div>
                            {u.bio && (
                              <div style={{ fontSize: 11, color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {u.bio}
                              </div>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Empty search state */}
                  {repoResults.length === 0 && userResults.length === 0 && (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#a1a1aa' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                        No results found for &ldquo;{searchQuery}&rdquo;
                      </div>
                      <div style={{ fontSize: 12, color: '#71717a' }}>
                        Try searching for a different keyword or explore all repositories.
                      </div>
                    </div>
                  )}

                  {/* Direct Explore Link */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '4px 6px 0' }}>
                    <button
                      type="button"
                      onClick={() => handleSearchSubmit()}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.04)',
                        border: 'none',
                        color: '#1F2937',
                        fontSize: 12,
                        cursor: 'pointer',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Search style={{ width: 13, height: 13, color: '#a1a1aa' }} />
                        See all public results for &ldquo;{searchQuery}&rdquo;
                      </span>
                      <kbd
                        style={{
                          fontSize: 10,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: 'rgba(255,255,255,0.1)',
                          color: '#475569',
                        }}
                      >
                        ↵ Enter
                      </kbd>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Bottom Keyboard Shortcuts Bar */}
          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.02)',
              padding: '7px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              color: '#71717a',
            }}
          >
            <span>Search PandaHub</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <span>
                <kbd style={{ color: '#475569' }}>↵</kbd> Explore
              </span>
              <span>
                <kbd style={{ color: '#475569' }}>Esc</kbd> Close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
