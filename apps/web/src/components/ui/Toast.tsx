import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type ToastType = 'success' | 'error' | 'info';

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
};

type ToastOptions = {
  message: string;
  type: ToastType;
  duration?: number;
};

type ToastContextValue = {
  toast: (options: ToastOptions) => void;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  info: 3000,
};

let nextId = 0;

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(({ message, type, duration }: ToastOptions) => {
    const id = `toast-${++nextId}`;
    const dur = duration ?? DEFAULT_DURATION[type];
    setToasts(prev => [...prev, { id, message, type, duration: dur }]);

    if (dur > 0) {
      const timer = window.setTimeout(() => removeToast(id), dur);
      timersRef.current.set(id, timer);
    }
  }, [removeToast]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => window.clearTimeout(timer));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      {createPortal(
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`toast toast--${t.type}`}
              role={t.type === 'error' ? 'alert' : 'status'}
            >
              <span className="toast__icon">
                {t.type === 'success' && (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {t.type === 'error' && (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {t.type === 'info' && (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 16v-4M12 8h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </span>
              <span className="toast__message">{t.message}</span>
              <button
                type="button"
                className="toast__close"
                onClick={() => removeToast(t.id)}
                aria-label="Cerrar notificación"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};
