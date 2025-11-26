import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function RootRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('x-access-token');
    const user = localStorage.getItem('user');

    if (token && user) {
      // User is logged in, redirect to home
      navigate('/home', { replace: true });
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
      backgroundColor: '#F0FDF4',
      color: '#14532D'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '3rem',
          height: '3rem',
          border: '3px solid #E5E7EB',
          borderTopColor: '#16A34A',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 1rem'
        }}></div>
        <p>Loading...</p>
      </div>
    </div>
  );
}

