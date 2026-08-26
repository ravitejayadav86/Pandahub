'use client';

/**
 * ToastProvider + useToast hook.
 *
 * A global toast notification system with 4 severity levels:
 *   success | info | warning | error
 *
 * Error toasts include:
 *   - Severity-colored icon + border
 *   - Human message + optional hint
 *   - "Copy Request ID" button
 *   - Optional Retry action
 *   - Stays until manually dismissed (unlike success/info which auto-dismiss)
 *
 * Stacks up to 5 toasts; oldest is removed when the limit is exceeded.
 * Accessible: ARIA live region, keyboard dismissible (Escape key removes top toast).
 *
 * Usage:
 *   1. Wrap the app with <ToastProvider> in layout.tsx
 *   2. In any component: const toast = useToast()
 *      toast.error("Something broke", { hint: "Try again", requestId: "abc..." })
 *      toast.success("Saved!")
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

/* ─────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────── */

export type ToastSeverity = 'success' | 'info' | 'warning' | 'error';

export interface ToastOptions {
  hint?: string;
  requestId?: string;
  action?: { label: string; onClick: () => void };
  /** Duration in ms. 0 = persistent (never auto-dismiss). Default: 5000 for success/info, 0 for error */
  duration?: number;
}

export interface Toast {
  id: string;
  severity: ToastSeverity;
  message: string;
  options: ToastOptions;
  createdAt: number;
}

interface ToastContextValue {
  success: (message: string, options?: ToastOptions) => void;
  info:    (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  error:   (message: string, options?: ToastOptions) => void;
  dismiss: (id: string) => void;
}

/* ─────────────────────────────────────────────────────────────────────────
   Context
───────────────────────────────────────────────────────────────────────── */

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 5;
let _idCounter = 0;

/* ─────────────────────────────────────────────────────────────────────────
   Config per severity
───────────────────────────────────────────────────────────────────────── */

const SEVERITY_CONFIG: Record<ToastSeverity, {
  icon: string;
  borderColor: string;
  bgColor: string;
  iconBg: string;
  textColor: string;
  defaultDuration: number;
}> = {
  success: {
    icon: '✓',
    borderColor: 'border-emerald-500/30',
    bgColor:     'bg-emerald-500/10',
    iconBg:      'bg-emerald-500',
    textColor:   'text-emerald-400',
    defaultDuration: 4000,
  },
  info: {
    icon: 'i',
    borderColor: 'border-blue-500/30',
    bgColor:     'bg-blue-500/10',
    iconBg:      'bg-blue-500',
    textColor:   'text-blue-400',
    defaultDuration: 5000,
  },
  warning: {
    icon: '!',
    borderColor: 'border-amber-500/30',
    bgColor:     'bg-amber-500/10',
    iconBg:      'bg-amber-500',
    textColor:   'text-amber-400',
    defaultDuration: 6000,
  },
  error: {
    icon: '✕',
    borderColor: 'border-red-500/30',
    bgColor:     'bg-red-500/10',
    iconBg:      'bg-red-500',
    textColor:   'text-red-400',
    defaultDuration: 0, // errors persist until dismissed
  },
};

/* ─────────────────────────────────────────────────────────────────────────
   Provider
───────────────────────────────────────────────────────────────────────── */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (severity: ToastSeverity, message: string, options: ToastOptions = {}) => {
      const id = String(++_idCounter);
      const toast: Toast = {
        id,
        severity,
        message,
        options,
        createdAt: Date.now(),
      };
      setToasts((prev) => {
        const next = [toast, ...prev];
        // Cap at MAX_TOASTS — remove oldest
        return next.slice(0, MAX_TOASTS);
      });

      // Auto-dismiss
      const cfg = SEVERITY_CONFIG[severity];
      const duration = options.duration !== undefined ? options.duration : cfg.defaultDuration;
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const ctx: ToastContextValue = {
    success: (msg, opts) => add('success', msg, opts),
    info:    (msg, opts) => add('info', msg, opts),
    warning: (msg, opts) => add('warning', msg, opts),
    error:   (msg, opts) => add('error', msg, opts),
    dismiss,
  };

  // Escape key dismisses the topmost toast
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toasts.length > 0) {
        dismiss(toasts[0].id);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toasts, dismiss]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Hook
───────────────────────────────────────────────────────────────────────── */

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}

/* ─────────────────────────────────────────────────────────────────────────
   Toast Container
───────────────────────────────────────────────────────────────────────── */

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-3 w-[380px] max-w-[calc(100vw-2rem)]"
    >
      {[...toasts].reverse().map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Single Toast Item
───────────────────────────────────────────────────────────────────────── */

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const cfg = SEVERITY_CONFIG[toast.severity];

  // Mount animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const copyRequestId = () => {
    if (!toast.options.requestId) return;
    navigator.clipboard.writeText(toast.options.requestId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      role="alert"
      className={`
        relative rounded-2xl border backdrop-blur-xl overflow-hidden
        transition-all duration-300 ease-out
        ${cfg.borderColor} ${cfg.bgColor}
        ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
        shadow-xl shadow-black/30
      `}
      style={{ background: 'rgba(13, 17, 23, 0.92)' }}
    >
      {/* Top accent stripe */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${cfg.iconBg} opacity-60`} />

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 w-7 h-7 rounded-lg ${cfg.iconBg} flex items-center justify-center mt-0.5 shadow-md`}>
            <span className="text-white text-xs font-bold">{cfg.icon}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white leading-snug">{toast.message}</p>

            {toast.options.hint && (
              <p className={`text-xs mt-1 leading-snug ${cfg.textColor} opacity-80`}>
                {toast.options.hint}
              </p>
            )}

            {/* Action buttons row */}
            {(toast.options.action || toast.options.requestId) && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {toast.options.action && (
                  <button
                    onClick={() => {
                      toast.options.action!.onClick();
                      handleDismiss();
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg ${cfg.iconBg} text-white font-medium hover:opacity-90 transition-opacity`}
                  >
                    {toast.options.action.label}
                  </button>
                )}
                {toast.options.requestId && (
                  <button
                    onClick={copyRequestId}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/8 text-slate-400 hover:text-slate-200 hover:bg-white/12 transition-all border border-white/8"
                  >
                    {copied ? '✓ ID Copied' : '⎘ Copy Request ID'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-all text-xs mt-0.5"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
