import React, { useEffect, useMemo, useState } from 'react';

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  currency: string;
};

type Transaction = {
  id: string;
  type: 'income' | 'expense';
  amount: string;
  category: string | null;
  note: string | null;
  occurredAt: string;
};

const API_URL: string = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';
const API_BASE = `${API_URL}/api/v1`;

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 16,
  padding: 16,
  boxShadow: '0 10px 25px rgba(17, 24, 39, 0.06)',
  border: '1px solid rgba(17, 24, 39, 0.06)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 12px',
  borderRadius: 12,
  border: '1px solid rgba(17, 24, 39, 0.12)',
  background: '#FFFFFF',
  fontSize: 14,
  outline: 'none',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: 'none',
  background: '#111827',
  color: '#FFFFFF',
  fontWeight: 700,
  fontSize: 14,
};

const ghostButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid rgba(17, 24, 39, 0.18)',
  background: '#FFFFFF',
  color: '#111827',
  fontWeight: 700,
  fontSize: 14,
};

const formatMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const toIsoDateTime = (date: Date) => date.toISOString();

export const Home: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>(() => (token ? 'login' : 'login'));
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txBusy, setTxBusy] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txNote, setTxNote] = useState('');

  const apiFetch = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const headers = new Headers(init?.headers || {});
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const message = data?.message || `Error (${res.status})`;
      throw new Error(message);
    }
    return data as T;
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    setTransactions([]);
    setAuthMode('login');
    setAuthError(null);
    setTxError(null);
  };

  const loadMe = async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ user: AuthUser }>('/me', { method: 'GET' });
      setUser(data.user);
    } catch {
      logout();
    }
  };

  const loadTransactions = async () => {
    if (!token) return;
    setTxError(null);
    try {
      const data = await apiFetch<{ transactions: Transaction[] }>('/transactions', { method: 'GET' });
      setTransactions(data.transactions || []);
    } catch (e: any) {
      setTxError(e?.message || 'No se pudieron cargar los movimientos');
    }
  };

  useEffect(() => {
    loadMe();
  }, [token]);

  useEffect(() => {
    if (user) loadTransactions();
  }, [user?.id]);

  const balance = useMemo(() => {
    return transactions.reduce((acc, t) => {
      const amount = Number(t.amount);
      const value = Number.isFinite(amount) ? amount : 0;
      return acc + (t.type === 'income' ? value : -value);
    }, 0);
  }, [transactions]);

  const onLogin = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      const data = await apiFetch<{ token: string; user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (e: any) {
      setAuthError(e?.message || 'No se pudo iniciar sesión');
    } finally {
      setAuthBusy(false);
    }
  };

  const onRegister = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      const data = await apiFetch<{ token: string; user: AuthUser }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: registerEmail, password: registerPassword, name: registerName }),
      });
      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
    } catch (e: any) {
      setAuthError(e?.message || 'No se pudo crear la cuenta');
    } finally {
      setAuthBusy(false);
    }
  };

  const onCreateTransaction = async () => {
    if (!txAmount) return;
    setTxBusy(true);
    setTxError(null);
    try {
      const payload = {
        type: txType,
        amount: txAmount,
        category: txCategory || undefined,
        note: txNote || undefined,
        occurredAt: toIsoDateTime(new Date()),
      };
      const data = await apiFetch<{ transaction: Transaction }>('/transactions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setTransactions(prev => [data.transaction, ...prev]);
      setTxAmount('');
      setTxCategory('');
      setTxNote('');
    } catch (e: any) {
      setTxError(e?.message || 'No se pudo guardar');
    } finally {
      setTxBusy(false);
    }
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Empezar</div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#6B7280' }}>
            Inicia sesión o crea una cuenta. Pensado para usarlo principalmente desde el móvil.
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 999,
                border: authMode === 'login' ? '1px solid #111827' : '1px solid rgba(17,24,39,0.15)',
                background: authMode === 'login' ? '#111827' : '#FFFFFF',
                color: authMode === 'login' ? '#FFFFFF' : '#111827',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('register')}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 999,
                border: authMode === 'register' ? '1px solid #111827' : '1px solid rgba(17,24,39,0.15)',
                background: authMode === 'register' ? '#111827' : '#FFFFFF',
                color: authMode === 'register' ? '#FFFFFF' : '#111827',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              Crear cuenta
            </button>
          </div>
        </div>

        <div style={cardStyle}>
          {authMode === 'login' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>Iniciar sesión</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Email</label>
                <input
                  style={inputStyle}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="tucorreo@ejemplo.com"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Contraseña</label>
                <input
                  style={inputStyle}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Tu contraseña"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                />
              </div>
              {authError ? (
                <div style={{ marginTop: 6, fontSize: 13, color: '#B91C1C', fontWeight: 600 }}>{authError}</div>
              ) : null}
              <button type="button" disabled={authBusy} onClick={onLogin} style={{ ...buttonStyle, opacity: authBusy ? 0.7 : 1 }}>
                {authBusy ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>Crear cuenta</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Nombre</label>
                <input
                  style={inputStyle}
                  type="text"
                  autoComplete="name"
                  placeholder="Tu nombre"
                  value={registerName}
                  onChange={e => setRegisterName(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Email</label>
                <input
                  style={inputStyle}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="tucorreo@ejemplo.com"
                  value={registerEmail}
                  onChange={e => setRegisterEmail(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Contraseña</label>
                <input
                  style={inputStyle}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={registerPassword}
                  onChange={e => setRegisterPassword(e.target.value)}
                />
              </div>
              {authError ? (
                <div style={{ marginTop: 6, fontSize: 13, color: '#B91C1C', fontWeight: 600 }}>{authError}</div>
              ) : null}
              <button
                type="button"
                disabled={authBusy}
                onClick={onRegister}
                style={{ ...buttonStyle, opacity: authBusy ? 0.7 : 1 }}
              >
                {authBusy ? 'Creando...' : 'Crear cuenta'}
              </button>
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, background: '#111827', color: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>API</div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{API_BASE}</div>
            </div>
            <button
              type="button"
              onClick={async () => {
                setAuthError(null);
                try {
                  await apiFetch('/health', { method: 'GET' });
                  setAuthError(null);
                } catch (e: any) {
                  setAuthError(e?.message || 'No se pudo conectar a la API');
                }
              }}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.12)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: 13,
                minWidth: 110,
              }}
            >
              Probar
            </button>
          </div>
          {authError ? <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>{authError}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...cardStyle, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 700 }}>Hola</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>{user.name || user.email}</div>
          </div>
          <button type="button" onClick={logout} style={{ padding: '10px 12px', borderRadius: 12, ...ghostButtonStyle, width: 'auto' }}>
            Salir
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          <div style={{ padding: 12, borderRadius: 14, background: '#F3F4F6', border: '1px solid rgba(17,24,39,0.06)' }}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 700 }}>Saldo</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#111827', marginTop: 4 }}>
              {formatMoney(balance, user.currency)}
            </div>
          </div>
          <div style={{ padding: 12, borderRadius: 14, background: '#F3F4F6', border: '1px solid rgba(17,24,39,0.06)' }}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 700 }}>Movimientos</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#111827', marginTop: 4 }}>{transactions.length}</div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#111827' }}>Nuevo movimiento</div>
          <button
            type="button"
            onClick={loadTransactions}
            style={{ padding: '10px 12px', borderRadius: 12, ...ghostButtonStyle, width: 'auto' }}
            disabled={txBusy}
          >
            Actualizar
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setTxType('expense')}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 12,
              border: txType === 'expense' ? '1px solid #111827' : '1px solid rgba(17,24,39,0.15)',
              background: txType === 'expense' ? '#111827' : '#FFFFFF',
              color: txType === 'expense' ? '#FFFFFF' : '#111827',
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            Gasto
          </button>
          <button
            type="button"
            onClick={() => setTxType('income')}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 12,
              border: txType === 'income' ? '1px solid #111827' : '1px solid rgba(17,24,39,0.15)',
              background: txType === 'income' ? '#111827' : '#FFFFFF',
              color: txType === 'income' ? '#FFFFFF' : '#111827',
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            Ingreso
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Monto</label>
            <input
              style={inputStyle}
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={txAmount}
              onChange={e => setTxAmount(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Categoría (opcional)</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="Comida, transporte..."
              value={txCategory}
              onChange={e => setTxCategory(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Nota (opcional)</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="Ej: cena con amigos"
              value={txNote}
              onChange={e => setTxNote(e.target.value)}
            />
          </div>
          {txError ? <div style={{ fontSize: 13, color: '#B91C1C', fontWeight: 700 }}>{txError}</div> : null}
          <button
            type="button"
            onClick={onCreateTransaction}
            disabled={txBusy || !txAmount}
            style={{ ...buttonStyle, opacity: txBusy || !txAmount ? 0.7 : 1 }}
          >
            {txBusy ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#111827' }}>Movimientos recientes</div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {transactions.length === 0 ? (
            <div style={{ color: '#6B7280', fontSize: 13, fontWeight: 600 }}>
              Todavía no tienes movimientos. Crea el primero arriba.
            </div>
          ) : (
            transactions.slice(0, 20).map(t => {
              const sign = t.type === 'income' ? '+' : '-';
              const color = t.type === 'income' ? '#047857' : '#B91C1C';
              const amount = Number(t.amount);
              const amountValue = Number.isFinite(amount) ? amount : 0;
              const when = new Date(t.occurredAt);
              const whenText = Number.isNaN(when.getTime())
                ? t.occurredAt
                : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(when);

              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: 12,
                    borderRadius: 14,
                    background: '#F9FAFB',
                    border: '1px solid rgba(17,24,39,0.06)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#111827' }}>
                      {t.category || (t.type === 'income' ? 'Ingreso' : 'Gasto')}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12, color: '#6B7280', fontWeight: 700 }}>{whenText}</div>
                    {t.note ? <div style={{ marginTop: 6, fontSize: 12, color: '#374151' }}>{t.note}</div> : null}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900, color }}>
                    {sign}
                    {formatMoney(amountValue, user.currency)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
