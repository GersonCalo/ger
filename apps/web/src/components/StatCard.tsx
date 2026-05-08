type StatCardProps = {
  label: string;
  value: string;
  tone?: 'default' | 'accent' | 'positive' | 'warning';
};

export const StatCard = ({ label, tone = 'default', value }: StatCardProps) => (
  <article className={`stat-card stat-card--${tone}`}>
    <div className="stat-card__label">{label}</div>
    <div className="stat-card__value">{value}</div>
  </article>
);
