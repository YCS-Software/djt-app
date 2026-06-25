import { BrowserRouter } from 'react-router-dom';
import './styles/global-theme.css';
import { AppRoutes } from './router';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { hydrateLastRoute } from './services/appState';
import OfflineBanner from './components/OfflineBanner';

function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize app
    let cancelled = false;
    (async () => {
      try {
        console.log('App initializing...');
        console.log('Platform:', Capacitor.getPlatform());
        console.log('Is Native:', Capacitor.isNativePlatform());

        // Log API URL for debugging
        if (Capacitor.isNativePlatform()) {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://192.168.1.100:5000/api';
          console.log('API URL:', apiUrl);
        }

        // Status bar: on Android 15 (edge-to-edge) keep the WebView below the
        // status bar with a solid dark bar + light icons, so headers aren't
        // clipped under the clock (F6).
        if (Capacitor.isNativePlatform()) {
          try {
            await StatusBar.setOverlaysWebView({ overlay: false });
            await StatusBar.setStyle({ style: Style.Dark });
            await StatusBar.setBackgroundColor({ color: '#0B1A2E' });
          } catch { /* plugin unavailable */ }
        }

        // Restore the durable "last route" mirror before the router mounts, so
        // RootRedirect can synchronously decide where to land (F1).
        await hydrateLastRoute();
      } catch (error) {
        console.error('App initialization error:', error);
      } finally {
        if (!cancelled) {
          setIsReady(true);
          console.log('App ready');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!isReady) {
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
          <p>Loading DJT HAIKA...</p>
        </div>
      </div>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <OfflineBanner />
      <BrowserRouter basename={__BASE_PATH__ || '/'}>
        <AppRoutes />
      </BrowserRouter>
    </I18nextProvider>
  );
}

export default App;
