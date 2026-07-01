const onboardingKey = (userId: string) => `finanzas.onboarding.completed.${userId}`;

export const hasCompletedOnboarding = (userId: string) => {
  try {
    return localStorage.getItem(onboardingKey(userId)) === 'true';
  } catch {
    return true;
  }
};

export const markOnboardingCompleted = (userId: string) => {
  try {
    localStorage.setItem(onboardingKey(userId), 'true');
  } catch {
    // Sin storage disponible no persistimos, pero no rompemos el flujo.
  }
};
