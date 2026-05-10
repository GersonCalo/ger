import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import { applyTheme, getTheme, setTheme } from '@/lib/theme';
import { hasAskedPermission, isPushEnabled, isPushSupported, markAsAsked, subscribeToPush } from '@/lib/push';
import type { ApiHealth, AuthResponse, AuthUser } from '@/types';

export const useAuth = () => {
  const [token, setToken] = useState<string | null>(() => storage.getToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [booting, setBooting] = useState(Boolean(storage.getToken()));
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (getTheme() === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const onAuthSuccess = useCallback((response: AuthResponse) => {
    storage.setToken(response.token);
    setToken(response.token);
    setUser(response.user);
    setAuthError(null);

    // Apply saved theme for this user
    applyTheme(getTheme());

    // Subscribe to push notifications (non-blocking)
    if (isPushSupported() && isPushEnabled() && !hasAskedPermission()) {
      markAsAsked();
      subscribeToPush(response.token).catch(() => {});
    }
  }, []);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const response = await api.login(input);
        onAuthSuccess(response);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'No se pudo iniciar sesion');
      } finally {
        setAuthBusy(false);
      }
    },
    [onAuthSuccess]
  );

  const register = useCallback(
    async (input: { email: string; password: string; name?: string }) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const response = await api.register(input);
        onAuthSuccess(response);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'No se pudo crear la cuenta');
      } finally {
        setAuthBusy(false);
      }
    },
    [onAuthSuccess]
  );

  const logoutBase = useCallback(() => {
    storage.clearToken();
    setToken(null);
    setUser(null);
    setAuthError(null);
    setBooting(false);

    // Reset theme to system on logout
    setTheme('system');
  }, []);

  const loadSession = useCallback(
    async (sessionToken: string) => {
      // Boot orchestration is handled by useFinanceApp; this only validates the session and loads the user.
      const nextUser = await api.me(sessionToken);
      setUser(nextUser);
      return nextUser;
    },
    []
  );

  useEffect(() => {
    if (!token) setBooting(false);
  }, [token]);

  return {
    isAuthenticated: Boolean(user && token),
    user,
    token,
    booting,
    authBusy,
    authError,
    health,
    login,
    register,
    logoutBase,
    loadSession,
    onAuthSuccess,
    setBooting,
    setAuthError,
  };
};
