import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type ToastType = 'success' | 'error' | 'info';

export type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  action?: ToastAction;
};

type TimerMeta = {
  timeoutId: ReturnType<typeof setTimeout> | null;
  startedAt: number;
  remainingMs: number;
  isPaused: boolean;
};

export type ShowToastInput = {
  type: ToastType;
  message: string;
  duration?: number;
  action?: ToastAction;
};

type ToastContextValue = {
  showToast: (input: ShowToastInput) => void;
  toast: (input: ShowToastInput) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  error: 6000,
  info: 3000,
};

const MAX_VISIBLE = 3;

let nextId = 0;

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [visible, setVisible] = useState<ToastItem[]>([]);
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, TimerMeta>>(new Map());

  const clearTimer = useCallback((id: string) => {
    const meta = timersRef.current.get(id);
    if (meta && meta.timeoutId !== null) {
      clearTimeout(meta.timeoutId);
      meta.timeoutId = null;
    }
  }, []);

  const startTimer = useCallback((id: string, durationMs: number, onExpire: (id: string) => void) => {
    const now = Date.now();
    const timeoutId = setTimeout(() => onExpire(id), durationMs);
    timersRef.current.set(id, {
      timeoutId,
      startedAt: now,
      remainingMs: durationMs,
      isPaused: false,
    });
  }, []);

  const pauseTimer = useCallback((id: string) => {
    const meta = timersRef.current.get(id);
    if (!meta || meta.isPaused || meta.timeoutId === null) return;
    clearTimeout(meta.timeoutId);
    meta.timeoutId = null;
    const elapsed = Date.now() - meta.startedAt;
    meta.remainingMs = Math.max(0, meta.remainingMs - elapsed);
    meta.isPaused = true;
  }, []);

  const resumeTimer = useCallback((id: string, onExpire: (id: string) => void) => {
    const meta = timersRef.current.get(id);
    if (!meta || !meta.isPaused || meta.remainingMs <= 0) return;
    const now = Date.now();
    const timeoutId = setTimeout(() => onExpire(id), meta.remainingMs);
    meta.timeoutId = timeoutId;
    meta.startedAt = now;
    meta.isPaused = false;
  }, []);

  const promoteFromQueue = useCallback(() => {
    setQueue(prev => {
      if (prev.length === 0) return prev;
      setVisible(current => {
        const slots = MAX_VISIBLE - current.length;
        if (slots <= 0) return current;
        const toPromote = prev.slice(0, slots);
        return [...current, ...toPromote];
      });
      return prev.slice(MAX_VISIBLE);
    });
  }, []);

  const handleExpire = useCallback((id: string) => {
    timersRef.current.delete(id);
    setVisible(prev => {
      const next = prev.filter(t => t.id !== id);
      return next;
    });
    setTimeout(() => promoteFromQueue(), 0);
  }, [promoteFromQueue]);

  const removeToast = useCallback((id: string) => {
    clearTimer(id);
    timersRef.current.delete(id);
    setVisible(prev => {
      const next = prev.filter(t => t.id !== id);
      return next;
    });
    setTimeout(() => promoteFromQueue(), 0);
  }, [clearTimer, promoteFromQueue]);

  const clearToasts = useCallback(() => {
    timersRef.current.forEach(({ timeoutId }) => {
      if (timeoutId !== null) clearTimeout(timeoutId);
    });
    timersRef.current.clear();
    setVisible([]);
    setQueue([]);
  }, []);

  const showToast = useCallback(({ message, type, duration, action }: ShowToastInput) => {
    const id = `toast-${++nextId}`;
    const dur = duration ?? DEFAULT_DURATION[type];
    const item: ToastItem = { id, message, type, duration: dur, action };

    setVisible(prev => {
      if (prev.length < MAX_VISIBLE) {
        if (dur > 0) {
          startTimer(id, dur, handleExpire);
        }
        return [...prev, item];
      }
      setQueue(q => [...q, item]);
      return prev;
    });
  }, [startTimer, handleExpire]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(({ timeoutId }) => {
        if (timeoutId !== null) clearTimeout(timeoutId);
      });
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, toast: showToast, removeToast, clearToasts }}>
      {children}
      {createPortal(
        <div className="toast-stack" role="status" aria-live="polite">
          {visible.map(t => (
            <div
              key={t.id}
              className={`toast toast--${t.type}`}
              role={t.type === 'error' ? 'alert' : 'status'}
              onMouseEnter={() => pauseTimer(t.id)}
              onMouseLeave={() => resumeTimer(t.id, handleExpire)}
              onPointerDown={() => pauseTimer(t.id)}
              onPointerUp={() => resumeTimer(t.id, handleExpire)}
              onPointerCancel={() => resumeTimer(t.id, handleExpire)}
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
              {t.action && (
                <button
                  type="button"
                  className="toast__action"
                  onClick={() => {
                    t.action!.onClick();
                    removeToast(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
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
              {t.duration > 0 && (
                <div
                  className="toast__progress"
                  style={{
                    animationDuration: `${t.duration}ms`,
                  }}
                />
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};
