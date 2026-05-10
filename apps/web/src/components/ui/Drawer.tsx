import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type DrawerSide = 'left' | 'right' | 'bottom';

type DrawerItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
};

type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  side?: DrawerSide;
  title?: string;
  items?: DrawerItem[];
  onItemClick?: (id: string) => void;
  children?: React.ReactNode;
};

export const Drawer = ({
  isOpen,
  onClose,
  side = 'left',
  title,
  items,
  onItemClick,
  children,
}: DrawerProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocused.current = document.activeElement as HTMLElement;
      setMounted(true);
      setVisible(true);
      document.body.style.overflow = 'hidden';
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    } else {
      setVisible(false);
      closeTimerRef.current = window.setTimeout(() => {
        setMounted(false);
        document.body.style.overflow = '';
        if (previouslyFocused.current) {
          previouslyFocused.current.focus();
        }
      }, 250);
    }

    return () => {
      document.body.style.overflow = '';
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen && panelRef.current) {
      const focusable = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`drawer-overlay drawer-overlay--${side} ${visible ? 'drawer-overlay--open' : 'drawer-overlay--closing'}`}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        ref={panelRef}
        className={`drawer-panel drawer-panel--${side}`}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Panel'}
      >
        {title && <div className="drawer-header">{title}</div>}
        {items && items.length > 0 ? (
          <nav className="drawer-nav" aria-label={title || 'Navegación'}>
            {items.map(item => (
              <button
                key={item.id}
                type="button"
                className={`drawer-nav__item ${item.active ? 'drawer-nav__item--active' : ''}`}
                onClick={() => {
                  onItemClick?.(item.id);
                  onClose();
                }}
              >
                <span className="drawer-nav__icon">{item.icon}</span>
                <span className="drawer-nav__label">{item.label}</span>
              </button>
            ))}
          </nav>
        ) : null}
        {children}
      </div>
    </div>,
    document.body
  );
};
