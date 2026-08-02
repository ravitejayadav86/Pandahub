'use client';
import { useState } from 'react';
import Link from 'next/link';

interface QuickSetupProps {
  /** Owner username or org slug */
  owner: string;
  /** Repository name */
  repoName: string;
  /**
   * Base URL of the PandaHub instance shown to the user.
   * Defaults to the current page origin so it works in every deployment.
   */
  baseUrl?: string;
}

// ── small helpers ────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      title="Copy to clipboard"
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: copied ? '#3fb950' : '#7d8590', padding: '4px 6px',
        borderRadius: 6, transition: 'color .15s', display: 'flex', alignItems: 'center',
        flexShrink: 0,
      }}
    >
      {copied
        ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
          </svg>
        )
        : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
          </svg>
        )
      }
    </button>
  );
}

function CodeBlock({ lines, copyText }: { lines: React.ReactNode[]; copyText: string }) {
  return (
    <div style={{
      background: '#010409',
      border: '1px solid #21262d',
      borderRadius: 6,
      padding: '14px 16px',
      position: 'relative',
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      fontSize: 13,
      lineHeight: 1.8,
    }}>
      <div style={{ position: 'absolute', top: 10, right: 10 }}>
        <CopyButton text={copyText} />
      </div>
      <div style={{ paddingRight: 32 }}>
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}

// Renders a single command line with keyword highlighting
function Cmd({ children }: { children: string }) {
  // Highlight the first word (git / panda) in teal, flags in blue-gray
  const parts = children.split(' ');
  const [cmd, ...rest] = parts;
  return (
    <span>
      <span style={{ color: '#58a6ff' }}>{cmd}</span>
      {rest.length > 0 && <span style={{ color: '#e6edf3' }}> {rest.join(' ')}</span>}
    </span>
  );
}

function Comment({ children }: { children: string }) {
  return <span style={{ color: '#7d8590', fontStyle: 'italic' }}>{children}</span>;
}

// ── main component ────────────────────────────────────────────────────────────

export default function QuickSetup({ owner, repoName, baseUrl }: QuickSetupProps) {
  const origin = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'https://pandahub.dev');
  const httpsUrl = `${origin}/git/${owner}/${repoName}.git`;
  const sshUrl   = `git@${new URL(origin).hostname}:${owner}/${repoName}.git`;

  const [protocol, setProtocol] = useState<'https' | 'ssh'>('https');
  const cloneUrl = protocol === 'https' ? httpsUrl : sshUrl;

  // ── command sets ────────────────────────────────────────────────────────────

  const createNewLines = [
    <Comment key="c0"># create & push a brand-new repository</Comment>,
    <Cmd key="c1">{`echo "# ${repoName}" >> README.md`}</Cmd>,
    <Cmd key="c2">git init</Cmd>,
    <Cmd key="c3">git add README.md</Cmd>,
    <Cmd key="c4">git commit -m "first commit"</Cmd>,
    <Cmd key="c5">git branch -M main</Cmd>,
    <Cmd key="c6">{`git remote add origin ${cloneUrl}`}</Cmd>,
    <Cmd key="c7">git push -u origin main</Cmd>,
  ];
  const createNewText = [
    `echo "# ${repoName}" >> README.md`,
    'git init',
    'git add README.md',
    'git commit -m "first commit"',
    'git branch -M main',
    `git remote add origin ${cloneUrl}`,
    'git push -u origin main',
  ].join('\n');

  const pushExistingLines = [
    <Comment key="p0"># push an existing local repository</Comment>,
    <Cmd key="p1">{`git remote add origin ${cloneUrl}`}</Cmd>,
    <Cmd key="p2">git branch -M main</Cmd>,
    <Cmd key="p3">git push -u origin main</Cmd>,
  ];
  const pushExistingText = [
    `git remote add origin ${cloneUrl}`,
    'git branch -M main',
    'git push -u origin main',
  ].join('\n');

  const pandaCliLines = [
    <Comment key="q0"># using the panda CLI (authenticates via your token)</Comment>,
    <Cmd key="q1">{`panda repo clone ${owner}/${repoName}`}</Cmd>,
    <Cmd key="q2">{'panda repo create --name my-project --private'}</Cmd>,
    <Cmd key="q3">{'panda repo list'}</Cmd>,
    <Cmd key="q4">{'panda issue list --repo my-project'}</Cmd>,
    <Cmd key="q5">{'panda pr create --title "fix: bug" --body "details"'}</Cmd>,
  ];
  const pandaCliText = [
    `panda repo clone ${owner}/${repoName}`,
    'panda repo create --name my-project --private',
    'panda repo list',
    'panda issue list --repo my-project',
    'panda pr create --title "fix: bug" --body "details"',
  ].join('\n');

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid #21262d',
      borderRadius: 6,
      overflow: 'hidden',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      color: '#e6edf3',
      fontSize: 14,
    }}>

      {/* ── Quick setup header ───────────────────────────────────────────── */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
          Quick setup
          <span style={{ color: '#7d8590', fontWeight: 400, fontSize: 13, marginLeft: 8 }}>
            — if you&apos;ve done this kind of thing before
          </span>
        </span>
      </div>

      {/* ── Clone URL bar ────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #21262d' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

          {/* Protocol toggle */}
          <div style={{
            display: 'flex',
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 6,
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {(['https', 'ssh'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProtocol(p)}
                style={{
                  padding: '4px 14px',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 600,
                  background: protocol === p ? '#21262d' : 'transparent',
                  color: protocol === p ? '#e6edf3' : '#7d8590',
                  transition: 'background .15s, color .15s',
                  textTransform: 'uppercase',
                  letterSpacing: '.04em',
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* URL input */}
          <div style={{
            flex: 1, minWidth: 200,
            display: 'flex', alignItems: 'center',
            background: '#010409',
            border: '1px solid #30363d',
            borderRadius: 6,
            overflow: 'hidden',
          }}>
            <input
              readOnly
              value={cloneUrl}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#58a6ff',
                fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
                fontSize: 13,
                padding: '5px 12px',
                outline: 'none',
              }}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <div style={{ borderLeft: '1px solid #21262d' }}>
              <CopyButton text={cloneUrl} />
            </div>
          </div>
        </div>

        <p style={{ color: '#7d8590', fontSize: 12, marginTop: 10, marginBottom: 0 }}>
          Get started by{' '}
          <Link href={`/${owner}/${repoName}/new/main?filename=README.md`} style={{ color: '#58a6ff', textDecoration: 'none' }}>
            creating a new file
          </Link>
          {' '}or{' '}
          <Link href={`/${owner}/${repoName}/upload`} style={{ color: '#58a6ff', textDecoration: 'none' }}>
            uploading an existing file
          </Link>
          . We recommend every repository include a{' '}
          <span style={{ color: '#58a6ff', cursor: 'pointer' }}>README</span>,{' '}
          <span style={{ color: '#58a6ff', cursor: 'pointer' }}>LICENSE</span>, and{' '}
          <span style={{ color: '#58a6ff', cursor: 'pointer' }}>.gitignore</span>.
        </p>
      </div>

      {/* ── Create a new repository on the command line ───────────────────── */}
      <div style={{ padding: '20px 20px 0' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#e6edf3' }}>
          ...or create a new repository on the command line
        </h3>
        <CodeBlock lines={createNewLines} copyText={createNewText} />
      </div>

      {/* ── Push an existing repository ──────────────────────────────────── */}
      <div style={{ padding: '20px 20px 0' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#e6edf3' }}>
          ...or push an existing repository from the command line
        </h3>
        <CodeBlock lines={pushExistingLines} copyText={pushExistingText} />
      </div>

      {/* ── panda CLI ────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 24px' }}>
        <h3 style={{
          fontSize: 15, fontWeight: 700, margin: '0 0 6px', color: '#e6edf3',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 20 }}>🐼</span>
          ...or use the panda CLI
        </h3>
        <p style={{ fontSize: 12, color: '#7d8590', margin: '0 0 12px' }}>
          Install with{' '}
          <code style={{
            background: '#161b22', border: '1px solid #30363d', borderRadius: 4,
            padding: '1px 6px',
            fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
            fontSize: 12, color: '#e6edf3',
          }}>
            pip install panda-cli
          </code>
          {' '}then authenticate once with{' '}
          <code style={{
            background: '#161b22', border: '1px solid #30363d', borderRadius: 4,
            padding: '1px 6px',
            fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
            fontSize: 12, color: '#e6edf3',
          }}>
            panda auth login
          </code>.
        </p>
        <CodeBlock lines={pandaCliLines} copyText={pandaCliText} />

        {/* panda CLI quick-reference table */}
        <div style={{
          marginTop: 16,
          border: '1px solid #21262d',
          borderRadius: 6,
          overflow: 'hidden',
          fontSize: 12,
        }}>
          <div style={{
            background: '#161b22',
            padding: '8px 14px',
            fontWeight: 600,
            fontSize: 12,
            color: '#7d8590',
            borderBottom: '1px solid #21262d',
            textTransform: 'uppercase',
            letterSpacing: '.05em',
          }}>
            panda CLI quick reference
          </div>
          {[
            { cmd: 'panda auth login',             desc: 'Authenticate with your PandaHub account' },
            { cmd: 'panda repo clone <owner/repo>', desc: 'Clone a repository' },
            { cmd: 'panda repo create',             desc: 'Create a new repository' },
            { cmd: 'panda repo list',               desc: 'List your repositories' },
            { cmd: 'panda repo delete <owner/repo>',desc: 'Delete a repository' },
            { cmd: 'panda issue list',              desc: 'List issues in the current repo' },
            { cmd: 'panda issue create',            desc: 'Open a new issue' },
            { cmd: 'panda pr list',                 desc: 'List pull requests' },
            { cmd: 'panda pr create',               desc: 'Open a new pull request' },
            { cmd: 'panda pr merge <number>',       desc: 'Merge a pull request' },
          ].map((row, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '7px 14px',
                borderBottom: i < 9 ? '1px solid #21262d' : 'none',
                background: i % 2 === 0 ? 'transparent' : '#0d1117',
              }}
            >
              <code style={{
                fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
                color: '#58a6ff',
                fontSize: 12,
                flexShrink: 0,
                minWidth: 280,
              }}>
                {row.cmd}
              </code>
              <span style={{ color: '#7d8590' }}>{row.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
