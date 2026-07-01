// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';

import { hasCompletedOnboarding, markOnboardingCompleted } from './onboarding';

describe('onboarding storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('devuelve false para un usuario nuevo', () => {
    expect(hasCompletedOnboarding('user-1')).toBe(false);
  });

  it('devuelve true después de marcar el onboarding como completado', () => {
    markOnboardingCompleted('user-1');

    expect(hasCompletedOnboarding('user-1')).toBe(true);
  });

  it('aísla el estado por usuario', () => {
    markOnboardingCompleted('user-1');

    expect(hasCompletedOnboarding('user-2')).toBe(false);
  });
});
