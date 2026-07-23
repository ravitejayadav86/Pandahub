import { BlobContent } from '@/types';

interface CodeViewerProps {
  blob: BlobContent;
}

const LANG_MAP: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', jsx: 'JSX',
  py: 'Python', go: 'Go', rs: 'Rust', java: 'Java', cpp: 'C++', c: 'C',
  cs: 'C#', rb: 'Ruby', php: 'PHP', swift: 'Swift', kt: 'Kotlin',
  md: 'Markdown', json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML',
  css: 'CSS', scss: 'SCSS', html: 'HTML', xml: 'XML', sql: 'SQL',
  sh: 'Shell', bash: 'Shell', dockerfile: 'Dockerfile',
  txt: 'Plain Text', env: 'Env',
};

function detectLang(path: string): string {
  const lower = path.toLowerCase();
  if (lower.includes('dockerfile')) return 'Dockerfile';
  const ext = lower.split('.').pop() || '';
  return LANG_MAP[ext] || 'Plain Text';
}

function decodeContent(blob: BlobContent): string {
  if (blob.encoding === 'base64') {
    try { return atob(blob.content.replace(/\s/g, '')); } catch { return blob.content; }
  }
  return blob.content;
}

const KiB = 1024;
const MAX_RENDER_BYTES = 500 * KiB;

export default function CodeViewer({ blob }: CodeViewerProps) {
  const lang = detectLang(blob.path);
  const raw = decodeContent(blob);
  const tooLarge = blob.size > MAX_RENDER_BYTES;
  const lines = tooLarge ? [] : raw.split('\n');

  const filename = blob.path.split('/').pop() || blob.path;
  const sizeLabel = blob.size < 1024 ? `${blob.size} B` : blob.size < 1048576 ? `${(blob.size / 1024).toFixed(1)} KB` : `${(blob.size / 1048576).toFixed(1)} MB`;

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>code</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{filename}</span>
          <span style={{ padding: '2px 8px', borderRadius: 6, background: '#f1f5f9', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{lang}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lines.length} lines</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sizeLabel}</span>
          <button onClick={() => navigator.clipboard.writeText(raw)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border-color)', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
            Copy
          </button>
        </div>
      </div>

      {/* Body */}
      {tooLarge ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>file_present</span>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>File is too large to display ({sizeLabel})</p>
          <p style={{ fontSize: 13 }}>Download the raw file to view its contents.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 13, lineHeight: 1.6 }}>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} style={{ transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <td style={{ padding: '0 16px', textAlign: 'right', color: '#94a3b8', userSelect: 'none', borderRight: '1px solid var(--border-color)', minWidth: 48, background: 'var(--bg-primary)', fontSize: 12 }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '0 20px', whiteSpace: 'pre', color: 'var(--text-primary)' }}>
                    {line || '\u00A0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}