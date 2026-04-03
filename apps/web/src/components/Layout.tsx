import React, { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div style={{ minHeight: '100vh', background: '#F6F7FB', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 16px 32px' }}>
        <header style={{ padding: '12px 0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, letterSpacing: 0.6 }}>
                Finanzas Integradas
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Tu dinero, claro</div>
            </div>
          </div>
        </header>
        <main>{children}</main>
        <footer style={{ marginTop: 28, color: '#6B7280', fontSize: 12, textAlign: 'center' }}>
          © {new Date().getFullYear()} Finanzas Integradas
        </footer>
      </div>
    </div>
  );
};
