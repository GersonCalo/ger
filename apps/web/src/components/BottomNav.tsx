import { useLocation, useNavigate } from 'react-router-dom';
import { bottomNavSections, getSectionByPathname } from '@/lib/navigation';

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = getSectionByPathname(location.pathname);

  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {bottomNavSections.map(section => (
        <button
          key={section.id}
          type="button"
          className={`bottom-nav__item ${section.id === activeSection.id ? 'bottom-nav__item--active' : ''}`}
          onClick={() => navigate(section.path)}
          aria-current={section.id === activeSection.id ? 'page' : undefined}
        >
          <span className="bottom-nav__icon">{section.icon}</span>
          <span className="bottom-nav__label">{section.shortLabel}</span>
        </button>
      ))}
    </nav>
  );
};
