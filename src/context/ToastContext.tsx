import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<Toast, 'id'>) => {
      const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      const newToast: Toast = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title?: string) => {
      showToast({ type: 'success', title, message });
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, title?: string) => {
      showToast({ type: 'error', title: title || 'Action Failed', message, duration: 6000 });
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, title?: string) => {
      showToast({ type: 'info', title, message });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, success, error, info }}>
      {children}

      {/* Toast Notification Container */}
      <aside
        className="fixed bottom-6 right-4 sm:right-6 z-[110] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        aria-live="polite"
        aria-label="System notifications"
      >
        {toasts.map((t) => {
          let icon = <Info className="w-4 h-4 text-[var(--ink)]" />;
          let borderClass = 'border-[var(--line)]';
          let accentBg = 'bg-[var(--bg)]';

          if (t.type === 'success') {
            icon = <CheckCircle2 className="w-4 h-4 text-[var(--g)]" />;
            borderClass = 'border-[var(--g)]';
            accentBg = 'bg-[var(--g)]/10';
          } else if (t.type === 'error') {
            icon = <AlertCircle className="w-4 h-4 text-[var(--r)]" />;
            borderClass = 'border-[var(--r)]';
            accentBg = 'bg-[var(--r)]/10';
          } else if (t.type === 'warning') {
            icon = <AlertTriangle className="w-4 h-4 text-[var(--a)]" />;
            borderClass = 'border-[var(--a)]';
            accentBg = 'bg-[var(--a)]/10';
          }

          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto p-4 rounded bg-[var(--bg)] border-2 ${borderClass} shadow-brutal flex items-start gap-3 transition-all transform animate-fade-in`}
            >
              <div className={`p-1.5 rounded ${accentBg} shrink-0 mt-0.5`}>{icon}</div>
              <div className="flex-1 min-w-0">
                {t.title && (
                  <h5 className="font-mono text-xs uppercase tracking-wider font-bold text-[var(--ink)] mb-0.5">
                    {t.title}
                  </h5>
                )}
                <p className="font-sans text-xs text-[var(--ink)] leading-snug">{t.message}</p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-[var(--mut)] hover:text-[var(--ink)] p-1 cursor-pointer shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </aside>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toasts: [],
      showToast: () => {},
      removeToast: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return context;
};
