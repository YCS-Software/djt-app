import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import { getRestorableRoute } from '../services/appState';

export default function RootRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('x-access-token');
    const user = localStorage.getItem('user');

    if (token && user) {
      // Restore the last screen the user was on (survives process death, F1);
      // fall back to the role's home if there's no recent/valid saved route.
      const restore = getRestorableRoute();
      navigate(restore || authService.homeRouteForRole(), { replace: true });
    } else {
      // User is not logged in, redirect to login
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Show loading while redirecting
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0B1220',
      color: '#E2E8F0'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '3rem',
          height: '3rem',
          border: '3px solid rgba(148,163,184,0.25)',
          borderTopColor: '#22D3EE',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 1rem'
        }}></div>
        <p>Loading...</p>
      </div>
    </div>
  );
}

