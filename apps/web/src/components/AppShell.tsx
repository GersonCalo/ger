import type { ReactNode } from 'react';
import { BottomNav } from '@/components/BottomNav';
import type { AppTab } from '@/types';

type AppShellProps = {
  activeTab?: AppTab;
  onTabChange?: (tab: AppTab) => void;
  headerTitle: string;
  headerSubtitle: string;
  children: ReactNode;
  showNav?: boolean;
};

export const AppShell = ({
  activeTab,
  children,
  headerSubtitle,
  headerTitle,
  onTabChange,
  showNav = true,
}: AppShellProps) => (
  <div className={`app-shell ${showNav ? 'app-shell--with-nav' : 'app-shell--no-nav'}`}>
    <div className="app-shell__frame">
      <header className="app-header">
        <div className="app-header__eyebrow">Finanzas Integradas</div>
        <h1 className="app-header__title">{headerTitle}</h1>
        <p className="app-header__subtitle">{headerSubtitle}</p>
      </header>

      <main className="app-content">{children}</main>
    </div>

    {showNav && activeTab && onTabChange ? <BottomNav activeTab={activeTab} onChange={onTabChange} /> : null}
  </div>
);
