type EmptyStateProps = {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

export const EmptyState = ({ actionLabel, description, icon, onAction, title }: EmptyStateProps) => (
  <div className="empty-state">
    <div className="empty-state__glyph">{icon || '✦'}</div>
    <div className="empty-state__title">{title}</div>
    <div className="empty-state__description">{description}</div>
    {actionLabel && onAction ? (
      <button type="button" className="button button--ghost" onClick={onAction}>
        {actionLabel}
      </button>
    ) : null}
  </div>
);
