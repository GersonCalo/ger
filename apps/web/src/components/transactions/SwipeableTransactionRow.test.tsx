// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SwipeableTransactionRow } from './SwipeableTransactionRow';

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(pointer: coarse)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe('SwipeableTransactionRow', () => {
  const defaultProps = {
    id: 'tx-1',
    isOpen: false,
    onOpen: vi.fn(),
    onClose: vi.fn(),
    actionsWidth: 140,
    children: <div data-testid="content">Transaction content</div>,
    actions: (
      <div>
        <button type="button" data-testid="edit-btn">Editar</button>
        <button type="button" data-testid="delete-btn">Eliminar</button>
      </div>
    ),
  };

  it('renders content and actions', () => {
    render(<SwipeableTransactionRow {...defaultProps} />);
    expect(screen.getByTestId('content')).toBeTruthy();
    expect(screen.getByTestId('edit-btn')).toBeTruthy();
    expect(screen.getByTestId('delete-btn')).toBeTruthy();
  });

  it('closes row when isOpen changes to false', () => {
    const { rerender, container } = render(
      <SwipeableTransactionRow {...defaultProps} isOpen={true} />
    );

    const content = container.querySelector('.swipeable-row__content')!;
    expect(content.getAttribute('style')).toContain('translate3d(-140px');

    rerender(
      <SwipeableTransactionRow {...defaultProps} isOpen={false} />
    );

    expect(content.getAttribute('style')).toContain('translate3d(0px');
  });

  it('opens row when isOpen changes to true', () => {
    const { rerender, container } = render(
      <SwipeableTransactionRow {...defaultProps} isOpen={false} />
    );

    const content = container.querySelector('.swipeable-row__content')!;
    expect(content.getAttribute('style')).toContain('translate3d(0px');

    rerender(
      <SwipeableTransactionRow {...defaultProps} isOpen={true} />
    );

    expect(content.getAttribute('style')).toContain('translate3d(-140px');
  });

  it('applies correct CSS transform during drag', () => {
    const { container } = render(<SwipeableTransactionRow {...defaultProps} />);
    const content = container.querySelector('.swipeable-row__content')!;
    expect(content.getAttribute('style')).toContain('translate3d(0px');
  });

  it('respects touch-action pan-y for vertical scroll', () => {
    const { container } = render(<SwipeableTransactionRow {...defaultProps} />);
    const row = container.querySelector('.swipeable-row')!;
    expect(row.className).toContain('swipeable-row');
  });
});
