import React, { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ borderBottom: '1px solid #eaeaea', paddingBottom: '16px', marginBottom: '24px' }}>
        <h1>Finanzas Integradas</h1>
      </header>
      <main>
        {children}
      </main>
      <footer style={{ marginTop: '48px', paddingTop: '16px', borderTop: '1px solid #eaeaea', color: '#666', fontSize: '0.9rem' }}>
        <p>© {new Date().getFullYear()} Finanzas Integradas. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};
