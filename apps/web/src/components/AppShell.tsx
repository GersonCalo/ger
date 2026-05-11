import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import { Drawer } from '@/components/ui/Drawer';
import { drawerSections, getSectionByPathname } from '@/lib/navigation';
import type { ReactNode } from 'react';

type AppShellProps = {
  headerTitle: string;
  headerSubtitle: string;
  children: ReactNode;
  showNav?: boolean;
};

export const AppShell = ({
  children,
  headerSubtitle,
  headerTitle,
  showNav = true,
}: AppShellProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeSection = getSectionByPathname(location.pathname);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    closeDrawer();
  }, [location.pathname, closeDrawer]);

  const handleDrawerItemClick = useCallback((id: string) => {
    const section = drawerSections.find(s => s.id === id);
    if (section) {
      navigate(section.path);
    }
  }, [navigate]);

  const drawerItems = drawerSections.map(section => ({
    id: section.id,
    label: section.label,
    icon: section.icon,
    active: section.id === activeSection.id,
  }));

  return (
    <div className={`app-shell ${showNav ? 'app-shell--with-nav' : 'app-shell--no-nav'}`}>
      <div className="app-shell__frame">
        <header className="app-header">
          <div className="app-header__top">
            <button
              type="button"
              className="app-header__menu-btn"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menú de navegación"
              aria-expanded={drawerOpen}
              aria-controls="nav-drawer"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <div className="app-header__text">
              <h1 className="app-header__title">{headerTitle}</h1>
              <p className="app-header__subtitle">{headerSubtitle}</p>
            </div>
          </div>
        </header>

        <main className="app-content">{children}</main>
      </div>

      {showNav && <BottomNav />}

      <Drawer
        isOpen={drawerOpen}
        onClose={closeDrawer}
        id="nav-drawer"
        side="left"
        title="Navegación"
        items={drawerItems}
        onItemClick={handleDrawerItemClick}
      />
    </div>
  );
};
