'use client';
import { useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface UploadedFile {
  file: File;
  /** relative path including any folder prefix, e.g. "src/utils/helper.ts" */
  relativePath: string;
}

interface UploadResult {
  commit_sha: string;
  branch: string;
  files_committed: number;
}

export default function UploadFilesPage() {
  const { user } = useAuthStore();
  const params = useParams<{ org: string; repo: string }>();
  const owner = params?.org ?? '';
  const repoName = params?.repo ?? '';
  const router = useRouter();

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [branch, setBranch] = useState('main');
  const [message, setMessage] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<UploadResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: File[], pathPrefix = '') => {
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.relativePath));
      const added: UploadedFile[] = [];
      for (const f of incoming) {
        const rel = (f as any).webkitRelativePath || f.name;
        const relativePath = pathPrefix ? `${pathPrefix}/${rel}` : rel;
        if (!existing.has(relativePath)) {
          added.push({ file: f, relativePath });
        }
      }
      return [...prev, ...added];
    });
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const items = e.dataTransfer.items;
    if (items) {
      const droppedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) droppedFiles.push(f);
        }
      }
      addFiles(droppedFiles);
    } else {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalSize = files.reduce((s, f) => s + f.file.size, 0);
  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) { setError('Add at least one file.'); return; }
    setError(''); setUploading(true);
    try {
      const fd = new FormData();
      for (const { file, relativePath } of files) {
        // Rename file to its relative path so the server knows the tree location
        const blob = new Blob([file], { type: file.type });
        fd.append('files', blob, relativePath);
      }
      fd.append('branch', branch);
      fd.append('message', message || `Add ${files.length} file${files.length > 1 ? 's' : ''} via PandaHub`);
      fd.append('target_path', targetPath.trim());

      const { data } = await api.post<UploadResult>(
        `/${owner}/${repoName}/git/upload`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Upload failed. Please try again.');
    }
    setUploading(false);
  };

  const repoBase = `/${owner}/${repoName}`;

  // ── Success screen ─────────────────────────────────────────────────────────
  if (result) {
    return (
      <main style={styles.root}>
        <PageHeader owner={owner} repoName={repoName} repoBase={repoBase} />
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 20px' }}>
          <div style={styles.successBox}>
            <div style={styles.successIcon}>
              <svg width="32" height="32" viewBox="0 0 16 16" fill="#3fb950">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e6edf3', margin: '0 0 8px' }}>
              Upload committed successfully!
            </h2>
            <p style={{ color: '#7d8590', margin: '0 0 20px', fontSize: 14 }}>
              {result.files_committed} file{result.files_committed > 1 ? 's' : ''} committed to{' '}
              <code style={styles.code}>{result.branch}</code>
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link href={`${repoBase}/tree`} style={styles.btnPrimary}>
                View file tree
              </Link>
              <Link href={repoBase} style={styles.btnDefault}>
                Back to repository
              </Link>
              <button
                onClick={() => { setResult(null); setFiles([]); }}
                style={styles.btnDefault}
              >
                Upload more files
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#484f58', marginTop: 20 }}>
              Commit: <code style={{ ...styles.code, fontSize: 11 }}>{result.commit_sha.slice(0, 12)}</code>
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ── Upload form ────────────────────────────────────────────────────────────
  return (
    <main style={styles.root}>
      <PageHeader owner={owner} repoName={repoName} repoBase={repoBase} />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px 80px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', margin: '0 0 4px' }}>
          Upload files
        </h1>
        <p style={{ color: '#7d8590', fontSize: 13, margin: '0 0 28px' }}>
          Drag &amp; drop files or folders, or click to browse. Files will be committed to the repository.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            ...styles.dropZone,
            ...(dragging ? styles.dropZoneActive : {}),
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={dragging ? '#58a6ff' : '#484f58'} strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" />
              <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
            </svg>
            <p style={{ color: '#cdd9e5', fontSize: 15, fontWeight: 600, margin: 0 }}>
              {dragging ? 'Drop files here' : 'Drag files and folders here'}
            </p>
            <p style={{ color: '#7d8590', fontSize: 13, margin: 0 }}>or</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={styles.btnDefault}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: 6 }}>
                  <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 8.75 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688Z" />
                </svg>
                Choose files
              </button>
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                style={styles.btnDefault}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: 6 }}>
                  <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1Z" />
                </svg>
                Choose folder
              </button>
            </div>
          </div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} />
          <input ref={folderInputRef} type="file" multiple className="hidden" onChange={handleFolderInput} // @ts-ignore
            {...{ webkitdirectory: '', directory: '' }} />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div style={{ margin: '20px 0', border: '1px solid #21262d', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              background: '#161b22', padding: '10px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 13, fontWeight: 600, borderBottom: '1px solid #21262d',
            }}>
              <span style={{ color: '#e6edf3' }}>{files.length} file{files.length > 1 ? 's' : ''} selected</span>
              <span style={{ color: '#7d8590' }}>{fmtSize(totalSize)} total</span>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {files.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 16px', borderBottom: i < files.length - 1 ? '1px solid #21262d' : 'none',
                  fontSize: 13,
                }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="#7d8590" style={{ flexShrink: 0 }}>
                    <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 8.75 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688Z" />
                  </svg>
                  <span style={{ flex: 1, color: '#e6edf3', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 12 }}>
                    {f.relativePath}
                  </span>
                  <span style={{ color: '#7d8590', flexShrink: 0, fontSize: 11 }}>{fmtSize(f.file.size)}</span>
                  <button
                    onClick={() => removeFile(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7d8590', padding: '2px 4px', borderRadius: 4, lineHeight: 1 }}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Commit form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="upload-target-path">
              Destination folder in repo
              <span style={{ color: '#7d8590', fontWeight: 400, marginLeft: 6 }}>(optional)</span>
            </label>
            <input
              id="upload-target-path"
              type="text"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="e.g. src/components  (leave blank for root)"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="upload-branch">Branch</label>
            <input
              id="upload-branch"
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              required
              style={{ ...styles.input, maxWidth: 280 }}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="upload-message">Commit message</label>
            <input
              id="upload-message"
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={files.length > 0 ? `Add ${files.length} file${files.length > 1 ? 's' : ''} via PandaHub` : 'Upload files via PandaHub'}
              style={styles.input}
            />
          </div>

          {error && (
            <div style={styles.errorBanner}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
              </svg>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 8, borderTop: '1px solid #21262d' }}>
            <button
              type="submit"
              disabled={uploading || files.length === 0}
              style={{
                ...styles.btnPrimary,
                opacity: (uploading || files.length === 0) ? 0.5 : 1,
                cursor: (uploading || files.length === 0) ? 'not-allowed' : 'pointer',
              }}
            >
              {uploading
                ? 'Committing...'
                : `Commit ${files.length > 0 ? files.length : ''} file${files.length !== 1 ? 's' : ''}`
              }
            </button>
            <Link href={repoBase} style={styles.btnDefault}>Cancel</Link>
          </div>
        </form>
      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PageHeader({ owner, repoName, repoBase }: { owner: string; repoName: string; repoBase: string }) {
  return (
    <header style={{
      background: '#161b22',
      borderBottom: '1px solid #21262d',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      position: 'sticky', top: 0, zIndex: 50,
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
    }}>
      <svg width="20" height="20" viewBox="0 0 16 16" fill="#e6edf3">
        <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Z" />
      </svg>
      <Link href={`/${owner}`} style={{ color: '#58a6ff', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
        {owner}
      </Link>
      <span style={{ color: '#484f58' }}>/</span>
      <Link href={repoBase} style={{ color: '#58a6ff', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
        {repoName}
      </Link>
      <span style={{ color: '#484f58' }}>/</span>
      <span style={{ color: '#e6edf3', fontSize: 14 }}>upload</span>
    </header>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const styles = {
  root: {
    minHeight: '100vh',
    background: '#0d1117',
    color: '#e6edf3',
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
    fontSize: 14,
  } as React.CSSProperties,
  dropZone: {
    border: '2px dashed #30363d',
    borderRadius: 6,
    padding: '48px 24px',
    textAlign: 'center' as const,
    cursor: 'default',
    transition: 'border-color 0.15s, background 0.15s',
    background: 'transparent',
    marginBottom: 8,
  } as React.CSSProperties,
  dropZoneActive: {
    borderColor: '#58a6ff',
    background: 'rgba(31,111,235,0.05)',
  } as React.CSSProperties,
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  } as React.CSSProperties,
  label: {
    fontSize: 13.5,
    fontWeight: 600,
    color: '#e6edf3',
  } as React.CSSProperties,
  input: {
    background: '#010409',
    border: '1px solid #30363d',
    borderRadius: 6,
    color: '#e6edf3',
    fontSize: 14,
    padding: '5px 12px',
    height: 32,
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px 16px',
    height: 32,
    fontSize: 13.5,
    fontWeight: 600,
    borderRadius: 6,
    cursor: 'pointer',
    border: '1px solid rgba(240,246,252,.1)',
    background: '#238636',
    color: '#fff',
    textDecoration: 'none',
    whiteSpace: 'nowrap' as const,
    fontFamily: 'inherit',
  } as React.CSSProperties,
  btnDefault: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5px 16px',
    height: 32,
    fontSize: 13.5,
    fontWeight: 600,
    borderRadius: 6,
    cursor: 'pointer',
    border: '1px solid rgba(240,246,252,.1)',
    background: '#21262d',
    color: '#cdd9e5',
    textDecoration: 'none',
    whiteSpace: 'nowrap' as const,
    fontFamily: 'inherit',
  } as React.CSSProperties,
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: 'rgba(248,81,73,.08)',
    border: '1px solid rgba(248,81,73,.4)',
    borderRadius: 6,
    color: '#f85149',
    fontSize: 13,
    fontWeight: 500,
  } as React.CSSProperties,
  successBox: {
    background: '#161b22',
    border: '1px solid rgba(63,185,80,.35)',
    borderRadius: 6,
    padding: '40px 32px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'rgba(63,185,80,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  } as React.CSSProperties,
  code: {
    fontFamily: "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace",
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 4,
    padding: '1px 6px',
    fontSize: 12,
    color: '#e6edf3',
  } as React.CSSProperties,
};
