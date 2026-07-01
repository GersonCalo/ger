import { useCallback, useEffect, useState } from 'react';
import { hasCompletedOnboarding, markOnboardingCompleted } from '@/lib/onboarding';
import type { AuthUser } from '@/types';

export const useOnboarding = ({ user }: { user: AuthUser | null }) => {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setShowOnboarding(Boolean(user) && !hasCompletedOnboarding(user!.id));
  }, [user]);

  const completeOnboarding = useCallback(() => {
    if (user) {
      markOnboardingCompleted(user.id);
    }
    setShowOnboarding(false);
  }, [user]);

  return { showOnboarding, completeOnboarding };
};
