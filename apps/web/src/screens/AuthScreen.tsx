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
      <section className="auth-hero">
        <div className="auth-hero__eyebrow">Personal + compartido</div>
        <h2 className="auth-hero__title">Controla tu dinero sin ruido.</h2>
        <p className="auth-hero__body">Todo tu balance y tus gastos compartidos en una sola rutina diaria.</p>
      </section>

      <SectionCard title={mode === 'login' ? 'Entrar' : 'Crear cuenta'} subtitle={mode === 'login' ? 'Acceso rápido.' : 'Empieza en un minuto.'}>
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

            <div className="inline-switch">
              <span>Aún no tienes cuenta</span>
              <button type="button" className="button button--ghost button--small" onClick={() => setMode('register')}>
                Crear cuenta
              </button>
            </div>
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

            <div className="inline-switch">
              <span>Ya tienes cuenta</span>
              <button type="button" className="button button--ghost button--small" onClick={() => setMode('login')}>
                Entrar
              </button>
            </div>
          </form>
        )}
      </SectionCard>
    </div>
  );
};
