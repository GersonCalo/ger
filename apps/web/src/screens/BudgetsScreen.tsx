import { EmptyState } from '@/components/ui/EmptyState';

export const BudgetsScreen = () => (
  <div className="screen-stack">
    <section className="screen-intro">
      <div className="screen-intro__eyebrow">Planificación</div>
      <h2 className="screen-intro__title">Presupuestos</h2>
    </section>
    <section className="section-card">
      <EmptyState
        icon="📊"
        title="Próximamente"
        description="Define límites de gasto por categoría y recibe alertas cuando te acerques al límite."
      />
    </section>
  </div>
);
