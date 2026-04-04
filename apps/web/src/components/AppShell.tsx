import type { ReactNode } from 'react';
import { BottomNav } from '@/components/BottomNav';
import type { AppTab } from '@/types';

type AppShellProps = {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  headerTitle: string;
  headerSubtitle: string;
  children: ReactNode;
};

export const AppShell = ({ activeTab, children, headerSubtitle, headerTitle, onTabChange }: AppShellProps) => (
  <div className="app-shell">
    <div className="app-shell__ambient app-shell__ambient--one" />
    <div className="app-shell__ambient app-shell__ambient--two" />

    <div className="app-shell__phone">
      <header className="app-header">
        <div className="app-header__eyebrow">Finanzas Integradas</div>
        <h1 className="app-header__title">{headerTitle}</h1>
        <p className="app-header__subtitle">{headerSubtitle}</p>
      </header>

      <main className="app-content">{children}</main>

      <BottomNav activeTab={activeTab} onChange={onTabChange} />
    </div>
  </div>
);
