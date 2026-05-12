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

  it('queued toast does not expire before becoming visible', () => {
    const toasts: ShowToastInput[] = [
      { type: 'success', message: 'Uno', duration: 500 },
      { type: 'success', message: 'Dos', duration: 500 },
      { type: 'success', message: 'Tres', duration: 500 },
      { type: 'success', message: 'Cuatro', duration: 500 },
    ];

    renderWithProvider(toasts);

    expect(screen.queryByText('Cuatro')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const first = document.querySelectorAll('.toast__message');
    expect(first.length).toBeLessThanOrEqual(3);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(screen.getByText('Cuatro')).toBeTruthy();
  });

  it('pauses at partial time and resumes with correct remaining', () => {
    renderWithProvider([{ type: 'success', message: 'Guardado', duration: 2000 }]);

    const toast = document.querySelector('.toast') as HTMLElement;

    act(() => {
      vi.advanceTimersByTime(500);
      fireEvent.mouseEnter(toast);
    });

    expect(screen.getByText('Guardado')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('Guardado')).toBeTruthy();

    act(() => {
      fireEvent.mouseLeave(toast);
      vi.advanceTimersByTime(1500);
    });

    expect(screen.queryByText('Guardado')).toBeNull();
  });

  it('rapid mouse enter/leave does not duplicate timers', () => {
    renderWithProvider([{ type: 'success', message: 'Guardado', duration: 1000 }]);

    const toast = document.querySelector('.toast') as HTMLElement;

    act(() => {
      for (let i = 0; i < 10; i++) {
        fireEvent.mouseEnter(toast);
        fireEvent.mouseLeave(toast);
      }
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText('Guardado')).toBeNull();
  });

  it('pointer down/up pauses and resumes correctly', () => {
    renderWithProvider([{ type: 'success', message: 'Guardado', duration: 2000 }]);

    const toast = document.querySelector('.toast') as HTMLElement;

    act(() => {
      fireEvent.pointerDown(toast);
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Guardado')).toBeTruthy();

    act(() => {
      fireEvent.pointerUp(toast);
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByText('Guardado')).toBeNull();
  });

  it('pointer cancel resumes timer', () => {
    renderWithProvider([{ type: 'success', message: 'Guardado', duration: 1000 }]);

    const toast = document.querySelector('.toast') as HTMLElement;

    act(() => {
      fireEvent.pointerDown(toast);
      fireEvent.pointerCancel(toast);
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText('Guardado')).toBeNull();
  });

  it('clearToasts removes all visible and queued toasts', () => {
    const ClearButton = () => {
      const { clearToasts } = useToast();
      return <button onClick={clearToasts}>Clear all</button>;
    };

    const { container } = render(
      <ToastProvider>
        <TestConsumer toasts={[
          { type: 'success', message: 'Uno' },
          { type: 'success', message: 'Dos' },
          { type: 'success', message: 'Tres' },
          { type: 'success', message: 'Cuatro' },
        ]} />
        <ClearButton />
      </ToastProvider>
    );

    expect(document.querySelectorAll('.toast__message').length).toBe(3);

    fireEvent.click(screen.getByText('Clear all'));

    expect(document.querySelectorAll('.toast__message').length).toBe(0);
    expect(screen.queryByText('Cuatro')).toBeNull();
  });

  it('toast alias works same as showToast', () => {
    const ToastAliasConsumer = () => {
      const { toast } = useToast();
      React.useEffect(() => {
        toast({ type: 'info', message: 'Vía alias' });
      }, []);
      return null;
    };

    render(
      <ToastProvider>
        <ToastAliasConsumer />
      </ToastProvider>
    );

    expect(screen.getByText('Vía alias')).toBeTruthy();
  });

  it('multiple toasts with different durations expire independently', () => {
    renderWithProvider([
      { type: 'success', message: 'Corto', duration: 500 },
      { type: 'error', message: 'Largo', duration: 3000 },
    ]);

    expect(screen.getByText('Corto')).toBeTruthy();
    expect(screen.getByText('Largo')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByText('Corto')).toBeNull();
    expect(screen.getByText('Largo')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(screen.queryByText('Largo')).toBeNull();
  });

  it('burst of toasts beyond queue limit preserves all', () => {
    const toasts: ShowToastInput[] = Array.from({ length: 10 }, (_, i) => ({
      type: 'info' as const,
      message: `Toast ${i + 1}`,
      duration: 2000,
    }));

    renderWithProvider(toasts);

    expect(document.querySelectorAll('.toast__message').length).toBe(3);

    for (let round = 0; round < 3; round++) {
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      act(() => {
        vi.advanceTimersByTime(50);
      });
    }

    const remaining = document.querySelectorAll('.toast__message');
    expect(remaining.length).toBeGreaterThanOrEqual(1);
  });

  it('manual close under load promotes next queued toast', () => {
    const toasts: ShowToastInput[] = Array.from({ length: 5 }, (_, i) => ({
      type: 'success' as const,
      message: `Toast ${i + 1}`,
    }));

    renderWithProvider(toasts);

    expect(document.querySelectorAll('.toast__message').length).toBe(3);
    expect(screen.queryByText('Toast 4')).toBeNull();
    expect(screen.queryByText('Toast 5')).toBeNull();

    const closeBtns = document.querySelectorAll('.toast__close');
    fireEvent.click(closeBtns[0] as HTMLElement);

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(screen.getByText('Toast 4')).toBeTruthy();
  });

  it('action CTA executes callback exactly once and closes toast', () => {
    const actionFn = vi.fn();
    renderWithProvider([
      {
        type: 'error',
        message: 'Error de red',
        action: { label: 'Reintentar', onClick: actionFn },
      },
    ]);

    expect(screen.getByText('Reintentar')).toBeTruthy();

    fireEvent.click(screen.getByText('Reintentar'));

    expect(actionFn).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Error de red')).toBeNull();
  });

  it('action CTA does not trigger auto-dismiss timer interference', () => {
    const actionFn = vi.fn();
    renderWithProvider([
      {
        type: 'error',
        message: 'Error de red',
        duration: 1000,
        action: { label: 'Reintentar', onClick: actionFn },
      },
    ]);

    act(() => {
      vi.advanceTimersByTime(500);
      fireEvent.click(screen.getByText('Reintentar'));
    });

    expect(actionFn).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Error de red')).toBeNull();
  });
});
