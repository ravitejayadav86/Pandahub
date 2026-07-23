import { TreeEntry } from '@/types';

interface FileTreeProps {
  entries: TreeEntry[];
  owner: string;
  repoName: string;
  ref: string;
  currentPath?: string;
  onNavigate: (path: string, type: 'blob' | 'tree') => void;
}

const FILE_ICONS: Record<string, string> = {
  ts: 'code', tsx: 'code', js: 'code', jsx: 'code',
  py: 'code', go: 'code', rs: 'code', java: 'code', cpp: 'code', c: 'code',
  md: 'article', txt: 'article', json: 'data_object', yaml: 'data_object', yml: 'data_object',
  toml: 'data_object', env: 'lock', gitignore: 'visibility_off',
  css: 'palette', scss: 'palette', html: 'html', svg: 'image',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
  pdf: 'picture_as_pdf', zip: 'folder_zip', tar: 'folder_zip', gz: 'folder_zip',
  sh: 'terminal', bash: 'terminal', dockerfile: 'deployed_code',
};

function fileIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower === 'dockerfile') return 'deployed_code';
  if (lower === '.gitignore') return 'visibility_off';
  const ext = lower.split('.').pop() || '';
  return FILE_ICONS[ext] || 'insert_drive_file';
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function FileTree({ entries, owner, repoName, ref, currentPath, onNavigate }: FileTreeProps) {
  const dirs = entries.filter(e => e.type === 'tree').sort((a, b) => a.name.localeCompare(b.name));
  const files = entries.filter(e => e.type === 'blob').sort((a, b) => a.name.localeCompare(b.name));
  const sorted = [...dirs, ...files];

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      {sorted.map((entry, i) => (
        <div key={entry.sha} onClick={() => onNavigate(entry.path, entry.type)} style={{
          display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center',
          padding: '10px 20px', borderBottom: i < sorted.length - 1 ? '1px solid var(--border-color)' : 'none',
          cursor: 'pointer', transition: 'background 0.15s', gap: 16,
        }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-primary)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span className="material-symbols-outlined" style={{
              fontSize: 18, flexShrink: 0,
              color: entry.type === 'tree' ? '#f59e0b' : 'var(--text-muted)',
            }}>
              {entry.type === 'tree' ? 'folder' : fileIcon(entry.name)}
            </span>
            <span style={{ fontSize: 14, color: 'var(--color-primary)', fontWeight: entry.type === 'tree' ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.name}
            </span>
          </div>
          {entry.type === 'blob' && entry.size && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{formatSize(entry.size)}</span>
          )}
        </div>
      ))}
      {sorted.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>folder_open</span>
          Empty directory
        </div>
      )}
    </div>
  );
}