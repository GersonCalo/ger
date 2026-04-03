import React, { useEffect, useState } from 'react';

export const Home: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<{ status: string; env: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:8080/api/v1/health')
      .then(res => res.json())
      .then(data => setApiStatus(data))
      .catch(err => setError(err.message));
  }, []);

  return (
    <div>
      <h2>Bienvenido</h2>
      <p>Frontend inicial. Gestiona tus finanzas personales y gastos compartidos.</p>
      
      <div style={{ marginTop: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h3>Estado de la API</h3>
        {error ? (
          <p style={{ color: 'red' }}>Error conectando a la API: {error}</p>
        ) : apiStatus ? (
          <ul>
            <li><strong>Status:</strong> {apiStatus.status}</li>
            <li><strong>Entorno:</strong> {apiStatus.env}</li>
          </ul>
        ) : (
          <p>Cargando estado...</p>
        )}
      </div>
    </div>
  );
};
