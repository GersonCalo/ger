import { EmptyState } from '@/components/ui/EmptyState';

export const RecurringScreen = () => (
  <div className="screen-stack">
    <section className="screen-intro">
      <div className="screen-intro__eyebrow">Automatización</div>
      <h2 className="screen-intro__title">Recurrentes</h2>
    </section>
    <section className="section-card">
      <EmptyState
        icon="🔄"
        title="Próximamente"
        description="Configura gastos periódicos y olvídate de registrarlos manualmente cada mes."
      />
    </section>
  </div>
);
