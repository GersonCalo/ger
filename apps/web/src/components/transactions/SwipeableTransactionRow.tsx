import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type SwipeableTransactionRowProps = {
  id: string;
  isOpen: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
  actionsWidth: number;
  children: ReactNode;
  actions: ReactNode;
};

const SWIPE_THRESHOLD_RATIO = 0.25;
const VERTICAL_LOCK_THRESHOLD = 10;

export const SwipeableTransactionRow = ({
  id,
  isOpen,
  onOpen,
  onClose,
  actionsWidth,
  children,
  actions,
}: SwipeableTransactionRowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isVerticalLock = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const [offset, setOffset] = useState(0);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const isTransitioning = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setIsCoarsePointer(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsCoarsePointer(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!isDragging.current) {
      isTransitioning.current = true;
      const targetOffset = isOpen ? -actionsWidth : 0;
      setOffset(targetOffset);
      const timer = setTimeout(() => {
        isTransitioning.current = false;
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen, actionsWidth]);

  const commitSwipe = useCallback(
    (finalOffset: number) => {
      if (finalOffset < -actionsWidth * SWIPE_THRESHOLD_RATIO) {
        setOffset(-actionsWidth);
        onOpen(id);
      } else {
        setOffset(0);
        onClose();
      }
    },
    [actionsWidth, id, onOpen, onClose]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isCoarsePointer) return;
      if (e.button !== 0) return;
      if (isTransitioning.current) return;

      isDragging.current = true;
      isVerticalLock.current = false;
      startX.current = e.clientX;
      startY.current = e.clientY;
      startOffset.current = offset;

      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture may fail in some environments
      }
    },
    [isCoarsePointer, offset]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;

      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;

      if (!isVerticalLock.current) {
        if (Math.abs(dy) > VERTICAL_LOCK_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
          isVerticalLock.current = true;
          isDragging.current = false;
          setOffset(startOffset.current);
          return;
        }
      }

      if (isVerticalLock.current) return;

      const newOffset = startOffset.current + dx;
      const clamped = Math.min(0, Math.max(-actionsWidth, newOffset));
      setOffset(clamped);
    },
    [actionsWidth]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return;

    isDragging.current = false;
    commitSwipe(offset);
  }, [commitSwipe, offset]);

  const style: React.CSSProperties = {
    transform: `translate3d(${offset}px, 0, 0)`,
    transition: isDragging.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)',
    willChange: 'transform',
  };

  return (
    <div
      ref={containerRef}
      className="swipeable-row"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="swipeable-row__actions" style={{ width: actionsWidth }}>
        {actions}
      </div>
      <div className="swipeable-row__content" style={style}>
        {children}
      </div>
    </div>
  );
};
