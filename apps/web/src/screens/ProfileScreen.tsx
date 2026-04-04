import { SectionCard } from '@/components/SectionCard';
import { StatCard } from '@/components/StatCard';
import { api } from '@/lib/api';
import type { ApiHealth, AuthUser } from '@/types';

type ProfileScreenProps = {
  health: ApiHealth | null;
  onLogout: () => void;
  user: AuthUser;
};

export const ProfileScreen = ({ health, onLogout, user }: ProfileScreenProps) => (
  <div className="screen-stack">
    <SectionCard title="Perfil" subtitle="Configuración de cuenta y estado del entorno.">
      <div className="profile-card">
        <div className="profile-card__avatar">{(user.name || user.email).slice(0, 1).toUpperCase()}</div>
        <div>
          <div className="profile-card__name">{user.name || 'Usuario'}</div>
          <div className="profile-card__email">{user.email}</div>
        </div>
      </div>
      <div className="stats-grid">
        <StatCard label="Moneda" value={user.currency} />
        <StatCard label="Entorno" value={health?.env || 'offline'} />
      </div>
    </SectionCard>

    <SectionCard title="Estado técnico" subtitle="Visibilidad rápida para revisar backend y despliegue.">
      <div className="list-stack">
        <article className="list-row">
          <div>
            <div className="list-row__title">API</div>
            <div className="list-row__meta">{api.baseUrl}</div>
          </div>
          <div className={`status-badge ${health ? 'status-badge--ok' : 'status-badge--warn'}`}>
            {health?.status || 'sin conexión'}
          </div>
        </article>
        <article className="list-row">
          <div>
            <div className="list-row__title">Experiencia móvil</div>
            <div className="list-row__meta">Navegación inferior, botones amplios y superficies touch-friendly</div>
          </div>
          <div className="status-badge status-badge--ok">lista</div>
        </article>
        <article className="list-row">
          <div>
            <div className="list-row__title">Grupos</div>
            <div className="list-row__meta">Disponibles en modo local hasta conectar el backend completo</div>
          </div>
          <div className="status-badge status-badge--warn">local</div>
        </article>
      </div>
    </SectionCard>

    <SectionCard title="Sesión" subtitle="Gestiona la salida de forma segura.">
      <button type="button" className="button button--ghost" onClick={onLogout}>
        Cerrar sesión
      </button>
    </SectionCard>
  </div>
);
