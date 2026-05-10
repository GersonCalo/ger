import { useCallback, useEffect, useRef, useState } from 'react';

type FabAction = {
  id: string;
  label: string;
  ariaLabel?: string;
  icon: React.ReactNode;
  disabled?: boolean;
};

type FabProps = {
  icon: React.ReactNode;
  onClick?: () => void;
  label?: string;
  actions?: FabAction[];
  onActionClick?: (id: string) => void;
};

export const FAB = ({ icon, onClick, label, actions, onActionClick }: FabProps) => {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isExpandable = actions && actions.length > 0;
  const menuId = 'fab-menu';

  const handleClick = useCallback(() => {
    if (isExpandable) {
      setExpanded(prev => !prev);
    } else {
      onClick?.();
    }
  }, [isExpandable, onClick]);

  const handleActionClick = useCallback(
    (id: string) => {
      setExpanded(false);
      onActionClick?.(id);
      triggerRef.current?.focus();
    },
    [onActionClick]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && expanded) {
        setExpanded(false);
        triggerRef.current?.focus();
      }
    },
    [expanded]
  );

  useEffect(() => {
    if (!expanded) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded]);

  return (
    <div
      ref={containerRef}
      className={`fab ${isExpandable && expanded ? 'fab--expanded' : ''}`}
      onKeyDown={handleKeyDown}
    >
      {isExpandable && expanded && (
        <div className="fab-actions" role="menu" id={menuId} aria-label="Acciones rápidas">
          {actions.map((action, index) => (
            <button
              key={action.id}
              type="button"
              className="fab-actions__item"
              role="menuitem"
              aria-label={action.ariaLabel || action.label}
              disabled={action.disabled}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => handleActionClick(action.id)}
            >
              <span className="fab-actions__icon">{action.icon}</span>
              <span className="fab-actions__label">{action.label}</span>
            </button>
          ))}
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        className="fab__button"
        onClick={handleClick}
        aria-label={label || (isExpandable ? 'Abrir acciones rápidas' : 'Acción')}
        aria-haspopup={isExpandable ? 'menu' : undefined}
        aria-expanded={isExpandable ? expanded : undefined}
        aria-controls={isExpandable ? menuId : undefined}
      >
        {icon}
      </button>
    </div>
  );
};
