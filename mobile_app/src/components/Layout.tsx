import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import './Layout.css';

const Layout = () => {
  return (
    <div className="app-layout">
      <main className="app-content">
        <Outlet />
      </main>
      <Navigation />
    </div>
  );
};

export default Layout;
