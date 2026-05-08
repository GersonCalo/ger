import type { ReactNode } from 'react';

type SectionCardProps = {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

export const SectionCard = ({ action, children, subtitle, title }: SectionCardProps) => (
  <section className="section-card">
    {(title || subtitle || action) && (
      <header className="section-card__header">
        <div>
          {title ? <h2 className="section-card__title">{title}</h2> : null}
          {subtitle ? <p className="section-card__subtitle">{subtitle}</p> : null}
        </div>
        {action ? <div className="section-card__action">{action}</div> : null}
      </header>
    )}
    {children}
  </section>
);
