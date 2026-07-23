interface LoadingSpinnerProps {
  size?: number;
  label?: string;
}

export default function LoadingSpinner({ size = 32, label = 'Loading…' }: LoadingSpinnerProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40, color: 'var(--text-muted)' }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: '3px solid var(--border-color)',
        borderTopColor: 'var(--color-primary)',
        animation: 'spin 0.7s linear infinite',
      }} />
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
