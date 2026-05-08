import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';
import { StatCard } from '@/components/StatCard';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import type { ApiHealth, AuthUser, Category } from '@/types';

type ProfileScreenProps = {
  health: ApiHealth | null;
  onLogout: () => void;
  user: AuthUser;
  categories: Category[];
  categoriesBusy: boolean;
  onCreateCategory: (input: { name: string; type: 'income' | 'expense'; color?: string; icon?: string }) => Promise<Category>;
  onUpdateCategory: (id: string, input: { name?: string; color?: string; icon?: string }) => Promise<Category>;
  onDeleteCategory: (id: string) => Promise<void>;
  isPushEnabled: boolean;
  isPushSupported: boolean;
  onSubscribeToPush: (token: string) => Promise<boolean>;
  onUnsubscribeFromPush: (token: string) => Promise<boolean>;
  theme: 'light' | 'dark' | 'system';
  onSetTheme: (theme: 'light' | 'dark' | 'system') => void;
};

const CATEGORY_COLORS = ['#EC4899', '#22C55E', '#3B82F6', '#F97316', '#A855F7', '#64748B', '#EF4444', '#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6'];
const CATEGORY_ICONS = ['💰', '💼', '🎁', '📈', '🛍️', '🎮', '🛒', '🚌', '🍽️', '👕', '🏠', '🏥', '📚', '📺', '✈️', '🔧', '💻', '🎓', '🚗', '🏦'];

export const ProfileScreen = ({ health, onLogout, user, categories, categoriesBusy, onCreateCategory, onUpdateCategory, onDeleteCategory, isPushEnabled, isPushSupported, onSubscribeToPush, onUnsubscribeFromPush, theme, onSetTheme }: ProfileScreenProps) => {
  const [categoryTab, setCategoryTab] = useState<'income' | 'expense'>('expense');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(CATEGORY_COLORS[0]);
  const [formIcon, setFormIcon] = useState(CATEGORY_ICONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = () => {
    onSetTheme('system');
    onLogout();
  };

  const personalCategories = categories.filter(c => c.userId !== null && c.groupId === null && c.type === categoryTab);
  const globalCategories = categories.filter(c => c.userId === null && c.groupId === null && c.type === categoryTab);

  const resetForm = () => {
    setFormName('');
    setFormColor(CATEGORY_COLORS[0]);
    setFormIcon(CATEGORY_ICONS[0]);
    setEditingCategory(null);
    setShowCreateForm(false);
    setError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setBusy(true);
    setError(null);
    try {
      await onCreateCategory({ name: formName.trim(), type: categoryTab, color: formColor, icon: formIcon });
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Error creando categoría');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !formName.trim()) return;

    setBusy(true);
    setError(null);
    try {
      await onUpdateCategory(editingCategory.id, { name: formName.trim(), color: formColor, icon: formIcon });
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Error actualizando categoría');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await onDeleteCategory(id);
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.message || 'Error eliminando categoría');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category);
    setFormName(category.name);
    setFormColor(category.color || CATEGORY_COLORS[0]);
    setFormIcon(category.icon || CATEGORY_ICONS[0]);
    setShowCreateForm(false);
    setError(null);
  };

  return (
    <div className="screen-stack">
      <section className="screen-intro">
        <div className="screen-intro__eyebrow">Cuenta</div>
        <h2 className="screen-intro__title">Perfil</h2>
      </section>

      <SectionCard title="Cuenta">
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

      <SectionCard title="Apariencia">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Tema</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {theme === 'dark' ? 'Modo oscuro' : theme === 'light' ? 'Modo claro' : 'Seguir al sistema'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['light', 'dark', 'system'] as const).map(t => (
              <button
                key={t}
                type="button"
                className={`button button--small ${theme === t ? 'button--primary' : 'button--ghost'}`}
                onClick={() => onSetTheme(t)}
              >
                {t === 'light' ? '☀' : t === 'dark' ? '☾' : '⚙'}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {isPushSupported && (
        <SectionCard title="Notificaciones">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Notificaciones push</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {isPushEnabled
                  ? 'Recibirás alertas de gastos, liquidaciones y cambios en tus grupos'
                  : 'Las notificaciones están desactivadas'}
              </div>
            </div>
            <button
              type="button"
              className={`button ${isPushEnabled ? 'button--ghost' : 'button--primary'} button--small`}
              onClick={async () => {
                const token = storage.getToken();
                if (!token) return;
                if (isPushEnabled) {
                  await onUnsubscribeFromPush(token);
                } else {
                  await onSubscribeToPush(token);
                }
                // Force re-render by toggling state (the hook uses localStorage)
                window.location.reload();
              }}
            >
              {isPushEnabled ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Categorías">
        <div className="category-manager">
          {/* Tabs Ingresos/Gastos */}
          <div className="category-tabs">
            <button
              type="button"
              className={`category-tabs__btn ${categoryTab === 'income' ? 'category-tabs__btn--active' : ''}`}
              onClick={() => { setCategoryTab('income'); resetForm(); }}
            >
              Ingresos
            </button>
            <button
              type="button"
              className={`category-tabs__btn ${categoryTab === 'expense' ? 'category-tabs__btn--active' : ''}`}
              onClick={() => { setCategoryTab('expense'); resetForm(); }}
            >
              Gastos
            </button>
          </div>

          {/* Botón Nueva Categoría */}
          {!showCreateForm && !editingCategory && (
            <button
              type="button"
              className="button button--primary button--full"
              onClick={() => { setShowCreateForm(true); setError(null); }}
            >
              + Nueva categoría
            </button>
          )}

          {/* Formulario Crear/Editar */}
          {(showCreateForm || editingCategory) && (
            <form className="category-form" onSubmit={editingCategory ? handleUpdate : handleCreate}>
              <div className="category-form__header">
                <h4>{editingCategory ? 'Editar categoría' : 'Nueva categoría'}</h4>
                <button type="button" className="button button--ghost button--sm" onClick={resetForm}>✕</button>
              </div>
              <label className="category-form__field">
                <span>Nombre</span>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Nombre de la categoría"
                  required
                />
              </label>
              <label className="category-form__field">
                <span>Icono</span>
                <div className="category-form__options">
                  {CATEGORY_ICONS.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      className={`category-form__option ${formIcon === icon ? 'category-form__option--active' : ''}`}
                      onClick={() => setFormIcon(icon)}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </label>
              <label className="category-form__field">
                <span>Color</span>
                <div className="category-form__options">
                  {CATEGORY_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`category-form__color ${formColor === color ? 'category-form__option--active' : ''}`}
                      style={{ background: color }}
                      onClick={() => setFormColor(color)}
                    />
                  ))}
                </div>
              </label>
              {error && <div className="category-form__error">{error}</div>}
              <button type="submit" className="button button--primary button--full" disabled={busy}>
                {busy ? 'Guardando...' : editingCategory ? 'Guardar cambios' : 'Crear categoría'}
              </button>
            </form>
          )}

          {/* Lista Categorías Personales */}
          {personalCategories.length > 0 && (
            <div className="category-list">
              <div className="category-list__header">
                <h4>Tus categorías</h4>
              </div>
              {personalCategories.map(cat => (
                deleteConfirm === cat.id ? (
                  <div key={cat.id} className="category-item category-item--confirm-delete">
                    <div className="category-item__info">
                      <span className="category-item__icon">{cat.icon || '📁'}</span>
                      <span className="category-item__name">{cat.name}</span>
                    </div>
                    <div className="category-item__actions">
                      <button type="button" className="button button--ghost button--sm" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
                      <button type="button" className="button button--danger button--sm" onClick={() => handleDelete(cat.id)} disabled={busy}>
                        {busy ? '...' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={cat.id} className="category-item">
                    <div className="category-item__info">
                      <span className="category-item__icon" style={{ background: cat.color || '#64748B' }}>{cat.icon || '📁'}</span>
                      <span className="category-item__name">{cat.name}</span>
                    </div>
                    <div className="category-item__actions">
                      <button type="button" className="button button--ghost button--sm" onClick={() => startEdit(cat)}>✏️</button>
                      <button type="button" className="button button--ghost button--sm" onClick={() => setDeleteConfirm(cat.id)}>🗑️</button>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {/* Lista Categorías Globales (solo lectura) */}
          {globalCategories.length > 0 && (
            <div className="category-list category-list--global">
              <div className="category-list__header">
                <h4>Por defecto</h4>
              </div>
              {globalCategories.map(cat => (
                <div key={cat.id} className="category-item category-item--global">
                  <div className="category-item__info">
                    <span className="category-item__icon" style={{ background: cat.color || '#64748B' }}>{cat.icon || '📁'}</span>
                    <span className="category-item__name">{cat.name}</span>
                  </div>
                  <div className="category-item__badge">
                    <span>por defecto</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {personalCategories.length === 0 && globalCategories.length === 0 && !showCreateForm && !editingCategory && (
            <div className="empty-state">
              <p>No hay categorías de {categoryTab === 'income' ? 'ingresos' : 'gastos'} aún.</p>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Estado">
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
              <div className="list-row__title">Experiencia</div>
              <div className="list-row__meta">Mobile-first y navegación inferior fija</div>
            </div>
            <div className="status-badge status-badge--ok">lista</div>
          </article>
          <article className="list-row">
            <div>
              <div className="list-row__title">Grupos</div>
              <div className="list-row__meta">Persistidos en PostgreSQL y servidos por la API de grupos</div>
            </div>
            <div className="status-badge status-badge--ok">api</div>
          </article>
        </div>
      </SectionCard>

      <SectionCard title="Sesión">
        <button type="button" className="button button--ghost" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </SectionCard>
    </div>
  );
};
