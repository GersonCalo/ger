import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';

const routeMeta: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Inicio', subtitle: 'Balance y actividad.' },
  '/transactions': { title: 'Movimientos', subtitle: 'Registrar y revisar.' },
  '/groups': { title: 'Grupos', subtitle: 'Compartidos.' },
  '/profile': { title: 'Perfil', subtitle: 'Cuenta y ajustes.' },
};

const getRouteMeta = (pathname: string) => {
  if (pathname.startsWith('/groups/')) return routeMeta['/groups'];
  return routeMeta[pathname] || routeMeta['/'];
};

export const DashboardLayout = () => {
  const location = useLocation();
  const { title, subtitle } = getRouteMeta(location.pathname);

  return (
    <AppShell headerTitle={title} headerSubtitle={subtitle}>
      <Outlet />
    </AppShell>
  );
};
