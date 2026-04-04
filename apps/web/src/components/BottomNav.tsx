import type { AppTab } from '@/types';

type BottomNavProps = {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
};

const tabs: Array<{ id: AppTab; label: string; icon: JSX.Element }> = [
  {
    id: 'home',
    label: 'Inicio',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    ),
  },
  {
    id: 'transactions',
    label: 'Movs',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6h14M5 12h14M5 18h14" />
      </svg>
    ),
  },
  {
    id: 'groups',
    label: 'Grupos',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 2a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19.5a5.5 5.5 0 0 1 11 0M12.5 19.5a4.5 4.5 0 0 1 8 0" />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Perfil',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
      </svg>
    ),
  },
];

export const BottomNav = ({ activeTab, onChange }: BottomNavProps) => (
  <nav className="bottom-nav" aria-label="Navegación principal">
    {tabs.map(tab => (
      <button
        key={tab.id}
        type="button"
        className={`bottom-nav__item ${tab.id === activeTab ? 'bottom-nav__item--active' : ''}`}
        onClick={() => onChange(tab.id)}
        aria-current={tab.id === activeTab ? 'page' : undefined}
      >
        <span className="bottom-nav__icon">{tab.icon}</span>
        <span className="bottom-nav__label">{tab.label}</span>
      </button>
    ))}
  </nav>
);
