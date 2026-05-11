import type { AppTab } from '@/types';
export { shouldShowFab, getFabRoutePolicy, FAB_ALLOWED_ROUTES, FAB_BLOCKED_ROUTES } from './fabVisibility';
export type { FabUiState } from './fabVisibility';

export type NavSection = {
  id: AppTab | 'budgets' | 'recurring';
  path: string;
  label: string;
  shortLabel: string;
  title: string;
  subtitle: string;
  icon: JSX.Element;
  inBottomNav: boolean;
  inDrawer: boolean;
  showFab: boolean;
};

const homeIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const transactionsIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 6h14M5 12h14M5 18h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const groupsIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 2a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19.5a5.5 5.5 0 0 1 11 0M12.5 19.5a4.5 4.5 0 0 1 8 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const budgetsIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2v20M17 7l-5-5-5 5M7 17l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const recurringIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-6.22-8.56" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M21 3v6h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const profileIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const navSections: NavSection[] = [
  {
    id: 'home',
    path: '/',
    label: 'Inicio',
    shortLabel: 'Inicio',
    title: 'Inicio',
    subtitle: 'Balance y actividad.',
    icon: homeIcon,
    inBottomNav: true,
    inDrawer: true,
    showFab: true,
  },
  {
    id: 'transactions',
    path: '/transactions',
    label: 'Movimientos',
    shortLabel: 'Movs',
    title: 'Movimientos',
    subtitle: 'Registrar y revisar.',
    icon: transactionsIcon,
    inBottomNav: true,
    inDrawer: true,
    showFab: true,
  },
  {
    id: 'groups',
    path: '/groups',
    label: 'Grupos',
    shortLabel: 'Grupos',
    title: 'Grupos',
    subtitle: 'Compartidos.',
    icon: groupsIcon,
    inBottomNav: true,
    inDrawer: true,
    showFab: true,
  },
  {
    id: 'budgets',
    path: '/budgets',
    label: 'Presupuestos',
    shortLabel: 'Presupuestos',
    title: 'Presupuestos',
    subtitle: 'Límites de gasto.',
    icon: budgetsIcon,
    inBottomNav: false,
    inDrawer: true,
    showFab: false,
  },
  {
    id: 'recurring',
    path: '/recurring',
    label: 'Recurrentes',
    shortLabel: 'Recurrentes',
    title: 'Recurrentes',
    subtitle: 'Gastos periódicos.',
    icon: recurringIcon,
    inBottomNav: false,
    inDrawer: true,
    showFab: false,
  },
  {
    id: 'profile',
    path: '/profile',
    label: 'Perfil',
    shortLabel: 'Perfil',
    title: 'Perfil',
    subtitle: 'Cuenta y ajustes.',
    icon: profileIcon,
    inBottomNav: false,
    inDrawer: true,
    showFab: false,
  },
];

export const getSectionByPathname = (pathname: string): NavSection => {
  if (pathname === '/' || pathname === '') return navSections[0];
  if (pathname === '/transactions') return navSections[1];
  if (pathname.startsWith('/groups')) return navSections[2];
  if (pathname === '/budgets') return navSections[3];
  if (pathname === '/recurring') return navSections[4];
  if (pathname === '/profile') return navSections[5];
  return navSections[0];
};

export const getActiveTab = (pathname: string): AppTab => {
  const section = getSectionByPathname(pathname);
  const tabMap: Record<string, AppTab> = {
    home: 'home',
    transactions: 'transactions',
    groups: 'groups',
    budgets: 'home',
    recurring: 'home',
    profile: 'home',
  };
  return tabMap[section.id] ?? 'home';
};

export const bottomNavSections = navSections.filter(s => s.inBottomNav);
export const drawerSections = navSections.filter(s => s.inDrawer);

export const getRouteMeta = (pathname: string) => {
  const section = getSectionByPathname(pathname);
  return { title: section.title, subtitle: section.subtitle };
};


