import { useState } from 'react';
import { SectionCard } from '@/components/SectionCard';

type AuthScreenProps = {
  busy: boolean;
  error: string | null;
  onLogin: (input: { email: string; password: string }) => Promise<void>;
  onRegister: (input: { email: string; password: string; name?: string }) => Promise<void>;
};

export const AuthScreen = ({ busy, error, onLogin, onRegister }: AuthScreenProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  return (
    <div className="screen-stack">
      <section className="hero-panel">
        <div className="hero-panel__badge">Mobile-first finance</div>
        <h2 className="hero-panel__title">Organiza tu dinero y comparte gastos sin fricción.</h2>
        <p className="hero-panel__copy">
          Accede rápido, registra movimientos con una sola mano y controla grupos desde una navegación inferior pensada para móvil.
        </p>
        <div className="hero-panel__grid">
          <div className="hero-panel__metric">
            <span>1</span>
            cuenta
          </div>
          <div className="hero-panel__metric">
            <span>∞</span>
            movimientos
          </div>
          <div className="hero-panel__metric">
            <span>24/7</span>
            control
          </div>
        </div>
      </section>

      <SectionCard
        title={mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        subtitle={mode === 'login' ? 'Vuelve a tu resumen diario.' : 'Empieza con tu espacio financiero personal.'}
      >
        <div className="auth-toggle">
          <button
            type="button"
            className={`segmented-control__item ${mode === 'login' ? 'segmented-control__item--active' : ''}`}
            onClick={() => setMode('login')}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`segmented-control__item ${mode === 'register' ? 'segmented-control__item--active' : ''}`}
            onClick={() => setMode('register')}
          >
            Crear cuenta
          </button>
        </div>

        {mode === 'login' ? (
          <form
            className="form-stack"
            onSubmit={event => {
              event.preventDefault();
              onLogin({ email: loginEmail, password: loginPassword });
            }}
          >
            <label className="field">
              <span className="field__label">Email</span>
              <input
                className="field__input"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={loginEmail}
                onChange={event => setLoginEmail(event.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">Contraseña</span>
              <input
                className="field__input"
                type="password"
                autoComplete="current-password"
                placeholder="Tu contraseña"
                value={loginPassword}
                onChange={event => setLoginPassword(event.target.value)}
              />
            </label>

            {error ? <div className="form-error">{error}</div> : null}

            <button type="submit" className="button button--primary" disabled={busy}>
              {busy ? 'Entrando...' : 'Iniciar sesión'}
            </button>
          </form>
        ) : (
          <form
            className="form-stack"
            onSubmit={event => {
              event.preventDefault();
              onRegister({
                name: registerName,
                email: registerEmail,
                password: registerPassword,
              });
            }}
          >
            <label className="field">
              <span className="field__label">Nombre</span>
              <input
                className="field__input"
                type="text"
                autoComplete="name"
                placeholder="Cómo quieres aparecer"
                value={registerName}
                onChange={event => setRegisterName(event.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">Email</span>
              <input
                className="field__input"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={registerEmail}
                onChange={event => setRegisterEmail(event.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">Contraseña</span>
              <input
                className="field__input"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={registerPassword}
                onChange={event => setRegisterPassword(event.target.value)}
              />
            </label>

            {error ? <div className="form-error">{error}</div> : null}

            <button type="submit" className="button button--primary" disabled={busy}>
              {busy ? 'Creando...' : 'Crear cuenta'}
            </button>
          </form>
        )}
      </SectionCard>
    </div>
  );
};
