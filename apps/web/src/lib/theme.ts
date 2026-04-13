export type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'app_theme';

const getStoredTheme = (): Theme | null => {
  const value = localStorage.getItem(THEME_KEY);
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return null;
};

const setStoredTheme = (theme: Theme) => {
  localStorage.setItem(THEME_KEY, theme);
};

const getSystemTheme = (): 'light' | 'dark' => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const applyTheme = (theme: Theme) => {
  const effective = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.classList.toggle('dark', effective === 'dark');
};

export const getTheme = (): Theme => {
  return getStoredTheme() || 'system';
};

export const setTheme = (theme: Theme) => {
  setStoredTheme(theme);
  applyTheme(theme);
};

export const toggleTheme = (): Theme => {
  const current = getTheme();
  const next: Theme = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
};

// Initialize on load
applyTheme(getTheme());
