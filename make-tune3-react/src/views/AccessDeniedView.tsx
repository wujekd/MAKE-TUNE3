import { useNavigate } from 'react-router-dom';

export function AccessDeniedView() {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: '1rem',
      color: 'var(--white)',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <h1 style={{ fontSize: '3rem', margin: 0 }}>🔒</h1>
      <h2 style={{ margin: 0 }}>Access Denied</h2>
      <p style={{ color: 'rgba(255, 255, 255, 0.7)', maxWidth: '400px' }}>
        You don't have permission to access this page. Admin privileges are required.
      </p>
      <button
        onClick={() => navigate('/collabs')}
        style={{
          padding: '0.75rem 1.5rem',
          borderRadius: '4px',
          border: '1px solid var(--contrast-600)',
          backgroundColor: 'var(--primary1-900)',
          color: 'var(--white)',
          cursor: 'pointer',
          fontSize: '1rem',
          marginTop: '1rem'
        }}
      >
        Back to Collaborations
      </button>
    </div>
  );
}

