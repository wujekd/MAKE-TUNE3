import { useNavigate, useLocation } from 'react-router-dom';

const ADMIN_LINKS = [
  { path: '/admin/feedback', label: 'Feedback' },
  { path: '/admin/users', label: 'Users' },
  { path: '/admin/reported', label: 'Reported' },
  { path: '/admin/resolved', label: 'Resolved' },
  { path: '/admin/projects', label: 'Projects' },
  { path: '/admin/tags', label: 'Tags' },
  { path: '/admin/settings', label: 'Settings' },
];

export function AdminNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav style={{
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 24
    }}>
      {ADMIN_LINKS.map(link => {
        const isActive = location.pathname === link.path;
        return (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            style={{
              padding: '8px 16px',
              background: isActive ? 'var(--contrast-600)' : 'rgba(255, 255, 255, 0.1)',
              border: isActive ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 6,
              color: 'var(--white)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              transition: 'background-color 0.15s'
            }}
          >
            {link.label}
          </button>
        );
      })}
    </nav>
  );
}
