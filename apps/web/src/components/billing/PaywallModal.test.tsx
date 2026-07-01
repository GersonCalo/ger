// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { PaywallModal } from './PaywallModal';
import { paywallCopy } from './paywall.copy';

afterEach(cleanup);

describe('PaywallModal', () => {
  // Scenario Gherkin HU-08.1:
  //   When intenta crear otro grupo
  //   Then el sistema debe bloquear la acción
  //   And debe mostrar una pantalla explicando el plan premium
  it('explica el plan premium y sus ventajas', () => {
    render(<PaywallModal isOpen onClose={vi.fn()} />);

    expect(screen.getByText(paywallCopy.title)).toBeTruthy();
    expect(screen.getByText(paywallCopy.description)).toBeTruthy();
    for (const benefit of paywallCopy.benefits) {
      expect(screen.getByText(benefit)).toBeTruthy();
    }
  });

  it('permite cerrar el paywall y seguir en el plan gratuito', () => {
    const onClose = vi.fn();
    render(<PaywallModal isOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: paywallCopy.dismissCta }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('no se renderiza cuando está cerrado', () => {
    render(<PaywallModal isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByText(paywallCopy.title)).toBeNull();
  });
});
