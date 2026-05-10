import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type DrawerSide = 'left' | 'right' | 'bottom';

type DrawerItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
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
  side = 'right',
  title,
  items,
  onItemClick,
  children,
}: DrawerProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      previouslyFocused.current = document.activeElement as HTMLElement;
      setMounted(true);
      document.body.style.overflow = 'hidden';
    } else {
      setMounted(false);
      document.body.style.overflow = '';
      if (previouslyFocused.current) {
        previouslyFocused.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = '';
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

  if (!mounted && !isOpen) return null;

  return createPortal(
    <div
      className={`drawer-overlay drawer-overlay--${side} ${isOpen ? 'drawer-overlay--open' : 'drawer-overlay--closing'}`}
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
                className="drawer-nav__item"
                onClick={() => onItemClick?.(item.id)}
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
