// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import React from 'react';
import { Drawer } from './Drawer';

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(pointer: coarse)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Drawer', () => {
  const defaultProps = {
    isOpen: false,
    onClose: vi.fn(),
    id: 'test-drawer',
    title: 'Test Drawer',
    children: <button type="button">Inside Button</button>,
  };

  describe('rendering', () => {
    it('does not render when closed', () => {
      render(<Drawer {...defaultProps} />);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders when open', () => {
      render(<Drawer {...defaultProps} isOpen />);
      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('renders title and uses it for aria-labelledby', () => {
      render(<Drawer {...defaultProps} isOpen />);
      const dialog = screen.getByRole('dialog');
      const titleId = dialog.getAttribute('aria-labelledby');
      expect(titleId).toBe('test-drawer-title');
      const titleEl = document.getElementById('test-drawer-title');
      expect(titleEl?.textContent).toBe('Test Drawer');
    });

    it('renders items as navigation', () => {
      const items = [
        { id: 'home', label: 'Inicio', icon: <span>H</span> },
        { id: 'settings', label: 'Ajustes', icon: <span>S</span> },
      ];
      render(<Drawer {...defaultProps} isOpen items={items} />);
      expect(screen.getByText('Inicio')).toBeTruthy();
      expect(screen.getByText('Ajustes')).toBeTruthy();
    });
  });

  describe('close mechanisms', () => {
    it('closes on backdrop click', () => {
      const onClose = vi.fn();
      render(<Drawer {...defaultProps} isOpen onClose={onClose} />);
      const overlay = document.querySelector('.drawer-overlay');
      fireEvent.click(overlay!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape key', () => {
      const onClose = vi.fn();
      render(<Drawer {...defaultProps} isOpen onClose={onClose} />);
      fireEvent.keyDown(document.querySelector('.drawer-overlay')!, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes on item click', () => {
      const onClose = vi.fn();
      const items = [{ id: 'home', label: 'Inicio', icon: <span>H</span> }];
      render(<Drawer {...defaultProps} isOpen onClose={onClose} items={items} />);
      fireEvent.click(screen.getByText('Inicio'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('swipe gesture', () => {
    it('closes on horizontal swipe that exceeds threshold', () => {
      const onClose = vi.fn();
      render(<Drawer {...defaultProps} isOpen onClose={onClose} side="left" />);
      const panel = screen.getByRole('dialog');

      fireEvent.pointerDown(panel, { clientX: 200, clientY: 100, button: 0 });
      fireEvent.pointerMove(panel, { clientX: 100, clientY: 100 });
      fireEvent.pointerUp(panel);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close on swipe below threshold', () => {
      const onClose = vi.fn();
      render(
        <Drawer {...defaultProps} isOpen onClose={onClose} side="left" swipeConfig={{ closeThresholdPx: 100 }} />
      );
      const panel = screen.getByRole('dialog');

      fireEvent.pointerDown(panel, { clientX: 200, clientY: 100, button: 0 });
      fireEvent.pointerMove(panel, { clientX: 150, clientY: 100 });
      fireEvent.pointerUp(panel);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not close when vertical scroll predominates', () => {
      const onClose = vi.fn();
      render(<Drawer {...defaultProps} isOpen onClose={onClose} side="left" />);
      const panel = screen.getByRole('dialog');

      fireEvent.pointerDown(panel, { clientX: 200, clientY: 100, button: 0 });
      fireEvent.pointerMove(panel, { clientX: 180, clientY: 120 });
      fireEvent.pointerUp(panel);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not activate gesture on fine pointer', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      const onClose = vi.fn();
      render(<Drawer {...defaultProps} isOpen onClose={onClose} side="left" />);
      const panel = screen.getByRole('dialog');

      fireEvent.pointerDown(panel, { clientX: 200, clientY: 100, button: 0 });
      fireEvent.pointerMove(panel, { clientX: 50, clientY: 100 });
      fireEvent.pointerUp(panel);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('applies drag transform during swipe', () => {
      render(<Drawer {...defaultProps} isOpen side="left" />);
      const panel = screen.getByRole('dialog');

      fireEvent.pointerDown(panel, { clientX: 200, clientY: 100, button: 0 });
      fireEvent.pointerMove(panel, { clientX: 100, clientY: 100 });

      expect(panel.getAttribute('style')).toContain('translateX(-100px)');
    });
  });

  describe('focus management', () => {
    it('returns focus to previously focused element on close', () => {
      const trigger = document.createElement('button');
      trigger.textContent = 'Open';
      document.body.appendChild(trigger);
      trigger.focus();

      const onClose = vi.fn();
      const { rerender } = render(<Drawer {...defaultProps} isOpen onClose={onClose} />);

      rerender(<Drawer {...defaultProps} isOpen={false} onClose={onClose} />);

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(document.activeElement).toBe(trigger);
    });
  });

  describe('scroll lock', () => {
    it('locks body scroll when open', () => {
      render(<Drawer {...defaultProps} isOpen />);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('releases body scroll on close', () => {
      const { rerender } = render(<Drawer {...defaultProps} isOpen />);
      rerender(<Drawer {...defaultProps} isOpen={false} />);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('accessibility', () => {
    it('has aria-modal="true"', () => {
      render(<Drawer {...defaultProps} isOpen />);
      expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    });

    it('has correct role="dialog"', () => {
      render(<Drawer {...defaultProps} isOpen />);
      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('traps focus with Tab key', () => {
      const onClose = vi.fn();
      const items = [
        { id: 'a', label: 'A', icon: <span>A</span> },
        { id: 'b', label: 'B', icon: <span>B</span> },
      ];
      render(<Drawer {...defaultProps} isOpen onClose={onClose} items={items} />);
      const panel = screen.getByRole('dialog');
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const last = focusable[focusable.length - 1];
      last.focus();

      fireEvent.keyDown(panel, { key: 'Tab' });

      const first = focusable[0];
      expect(document.activeElement).toBe(first);
    });

    it('traps focus with Shift+Tab from first element', () => {
      const onClose = vi.fn();
      const items = [
        { id: 'a', label: 'A', icon: <span>A</span> },
        { id: 'b', label: 'B', icon: <span>B</span> },
      ];
      render(<Drawer {...defaultProps} isOpen onClose={onClose} items={items} />);
      const panel = screen.getByRole('dialog');
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      first.focus();

      fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true });

      const last = focusable[focusable.length - 1];
      expect(document.activeElement).toBe(last);
    });
  });
});
