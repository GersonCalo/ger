// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

afterEach(cleanup);

import { OnboardingWelcome } from './OnboardingWelcome';
import { onboardingCopy } from './onboarding.copy';

const renderWelcome = (overrides: Partial<React.ComponentProps<typeof OnboardingWelcome>> = {}) => {
  const props = {
    isOpen: true,
    onAddExpense: vi.fn(),
    onCreateGroup: vi.fn(),
    onDismiss: vi.fn(),
    ...overrides,
  };

  render(<OnboardingWelcome {...props} />);

  return props;
};

describe('OnboardingWelcome', () => {
  // Scenario Gherkin HU-01.1:
  //   Given un usuario recién registrado
  //   When accede al dashboard por primera vez
  //   Then debe ver una explicación corta de la app
  //   And debe ver una acción principal para crear su primer movimiento
  //   And debe ver otra acción para crear su primer grupo
  it('muestra la explicación corta y las dos acciones principales', () => {
    renderWelcome();

    expect(screen.getByText(onboardingCopy.title)).toBeTruthy();
    expect(screen.getByText(onboardingCopy.description)).toBeTruthy();
    expect(screen.getByRole('button', { name: onboardingCopy.addExpenseCta })).toBeTruthy();
    expect(screen.getByRole('button', { name: onboardingCopy.createGroupCta })).toBeTruthy();
  });

  it('lanza onAddExpense al pulsar la acción de primer movimiento', () => {
    const props = renderWelcome();

    fireEvent.click(screen.getByRole('button', { name: onboardingCopy.addExpenseCta }));

    expect(props.onAddExpense).toHaveBeenCalledTimes(1);
  });

  it('lanza onCreateGroup al pulsar la acción de primer grupo', () => {
    const props = renderWelcome();

    fireEvent.click(screen.getByRole('button', { name: onboardingCopy.createGroupCta }));

    expect(props.onCreateGroup).toHaveBeenCalledTimes(1);
  });

  it('permite saltar el onboarding', () => {
    const props = renderWelcome();

    fireEvent.click(screen.getByRole('button', { name: onboardingCopy.skipCta }));

    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('no se renderiza cuando está cerrado', () => {
    renderWelcome({ isOpen: false });

    expect(screen.queryByText(onboardingCopy.title)).toBeNull();
  });
});
