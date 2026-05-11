// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';
import { ToastProvider, useToast, type ShowToastInput } from './Toast';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

const TestConsumer = ({ toasts }: { toasts: ShowToastInput[] }) => {
  const { showToast } = useToast();

  React.useEffect(() => {
    toasts.forEach(t => showToast(t));
  }, []);

  return null;
};

const renderWithProvider = (toasts: ShowToastInput[] = []) => {
  return render(
    <ToastProvider>
      <TestConsumer toasts={toasts} />
    </ToastProvider>
  );
};

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('shows a toast with success type', () => {
    renderWithProvider([{ type: 'success', message: 'Guardado' }]);

    expect(screen.getByText('Guardado')).toBeTruthy();
    expect(document.querySelector('.toast--success')).toBeTruthy();
  });

  it('shows a toast with error type', () => {
    renderWithProvider([{ type: 'error', message: 'Error al crear' }]);

    expect(screen.getByText('Error al crear')).toBeTruthy();
    expect(document.querySelector('.toast--error')).toBeTruthy();
  });

  it('shows a toast with info type', () => {
    renderWithProvider([{ type: 'info', message: 'Selecciona un grupo' }]);

    expect(screen.getByText('Selecciona un grupo')).toBeTruthy();
    expect(document.querySelector('.toast--info')).toBeTruthy();
  });

  it('auto-dismisses toast after duration', () => {
    renderWithProvider([{ type: 'success', message: 'Guardado', duration: 1000 }]);

    expect(screen.getByText('Guardado')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText('Guardado')).toBeNull();
  });

  it('removes toast manually via close button', () => {
    renderWithProvider([{ type: 'success', message: 'Guardado' }]);

    expect(screen.getByText('Guardado')).toBeTruthy();

    const closeBtn = document.querySelector('.toast__close') as HTMLElement;
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Guardado')).toBeNull();
  });

  it('respects MAX_VISIBLE limit and queues additional toasts', () => {
    const toasts: ShowToastInput[] = [
      { type: 'success', message: 'Uno' },
      { type: 'success', message: 'Dos' },
      { type: 'success', message: 'Tres' },
      { type: 'success', message: 'Cuatro' },
    ];

    renderWithProvider(toasts);

    const messages = document.querySelectorAll('.toast__message');
    expect(messages.length).toBe(3);
    expect(screen.queryByText('Cuatro')).toBeNull();
  });

  it('promotes queued toast when visible toast is removed', () => {
    const toasts: ShowToastInput[] = [
      { type: 'success', message: 'Uno' },
      { type: 'success', message: 'Dos' },
      { type: 'success', message: 'Tres' },
      { type: 'success', message: 'Cuatro' },
    ];

    renderWithProvider(toasts);

    expect(screen.queryByText('Cuatro')).toBeNull();

    const closeBtn = document.querySelector('.toast__close') as HTMLElement;
    fireEvent.click(closeBtn);

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(screen.getByText('Cuatro')).toBeTruthy();
  });

  it('renders action button when action is provided', () => {
    renderWithProvider([
      {
        type: 'error',
        message: 'Error al crear',
        action: { label: 'Reintentar', onClick: vi.fn() },
      },
    ]);

    expect(screen.getByText('Reintentar')).toBeTruthy();
  });

  it('calls action onClick and removes toast', () => {
    const actionFn = vi.fn();
    renderWithProvider([
      {
        type: 'error',
        message: 'Error al crear',
        action: { label: 'Reintentar', onClick: actionFn },
      },
    ]);

    const actionBtn = document.querySelector('.toast__action') as HTMLElement;
    fireEvent.click(actionBtn);

    expect(actionFn).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Error al crear')).toBeNull();
  });

  it('pauses timer on mouse enter and resumes on mouse leave', () => {
    renderWithProvider([{ type: 'success', message: 'Guardado', duration: 2000 }]);

    const toast = document.querySelector('.toast') as HTMLElement;
    expect(screen.getByText('Guardado')).toBeTruthy();

    act(() => {
      fireEvent.mouseEnter(toast);
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Guardado')).toBeTruthy();

    act(() => {
      fireEvent.mouseLeave(toast);
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByText('Guardado')).toBeNull();
  });

  it('uses default duration by type when not specified', () => {
    renderWithProvider([{ type: 'error', message: 'Error' }]);

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.queryByText('Error')).toBeNull();
  });
});
