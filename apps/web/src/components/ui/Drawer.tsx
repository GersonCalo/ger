import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type DrawerSide = 'left' | 'right' | 'bottom';

type DrawerItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
};

type SwipeConfig = {
  closeThresholdPx?: number;
  verticalLockThresholdPx?: number;
};

type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  side?: DrawerSide;
  id?: string;
  title?: string;
  items?: DrawerItem[];
  onItemClick?: (id: string) => void;
  children?: React.ReactNode;
  swipeConfig?: SwipeConfig;
};

const DEFAULT_SWIPE_CLOSE_THRESHOLD = 72;
const DEFAULT_VERTICAL_LOCK_THRESHOLD = 12;

export const Drawer = ({
  isOpen,
  onClose,
  side = 'left',
  id,
  title,
  items,
  onItemClick,
  children,
  swipeConfig,
}: DrawerProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const isDragging = useRef(false);
  const isVerticalLock = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const panelId = id ?? `drawer-panel-${useRef<string>(Math.random().toString(36).slice(2, 9)).current}`;

  const closeThreshold = swipeConfig?.closeThresholdPx ?? DEFAULT_SWIPE_CLOSE_THRESHOLD;
  const verticalLockThreshold = swipeConfig?.verticalLockThresholdPx ?? DEFAULT_VERTICAL_LOCK_THRESHOLD;

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setIsCoarsePointer(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsCoarsePointer(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (isOpen) {
      previouslyFocused.current = document.activeElement as HTMLElement;
      setMounted(true);
      setVisible(true);
      setDragOffset(0);
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

  const commitSwipe = useCallback(
    (offset: number) => {
      const panelWidth = panelRef.current?.getBoundingClientRect().width ?? 320;
      const shouldClose = side === 'left'
        ? offset < -closeThreshold
        : side === 'right'
          ? offset > closeThreshold
          : Math.abs(offset) > closeThreshold;

      if (shouldClose) {
        onClose();
      } else {
        setDragOffset(0);
      }
    },
    [closeThreshold, side, onClose]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isCoarsePointer) return;
      if (e.button !== 0) return;
      if (side === 'bottom') return;

      isDragging.current = true;
      isVerticalLock.current = false;
      startX.current = e.clientX;
      startY.current = e.clientY;

      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture may fail in some environments
      }
    },
    [isCoarsePointer, side]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;

      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;

      if (!isVerticalLock.current) {
        if (Math.abs(dy) > verticalLockThreshold && Math.abs(dy) > Math.abs(dx)) {
          isVerticalLock.current = true;
          isDragging.current = false;
          setDragOffset(0);
          return;
        }
      }

      if (isVerticalLock.current) return;

      if (side === 'left' && dx > 0) {
        setDragOffset(0);
        return;
      }
      if (side === 'right' && dx < 0) {
        setDragOffset(0);
        return;
      }

      setDragOffset(dx);
    },
    [side, verticalLockThreshold]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    commitSwipe(dragOffset);
  }, [commitSwipe, dragOffset]);

  const isSide = side === 'left' || side === 'right';
  const panelStyle: React.CSSProperties = isSide && isCoarsePointer && dragOffset !== 0
    ? {
        transform: `translateX(${dragOffset}px)`,
        transition: 'none',
      }
    : {};

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
        id={panelId}
        className={`drawer-panel drawer-panel--${side}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${panelId}-title` : undefined}
        aria-label={!title ? 'Panel' : undefined}
        style={panelStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {title && <div id={`${panelId}-title`} className="drawer-header">{title}</div>}
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
