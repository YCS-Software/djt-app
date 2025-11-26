
import { useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { path: '/', icon: 'ri-home-line', activeIcon: 'ri-home-fill', label: 'Home' },
  { path: '/charging', icon: 'ri-flashlight-line', activeIcon: 'ri-flashlight-fill', label: 'Charging' },
  { path: '/wallet', icon: 'ri-wallet-line', activeIcon: 'ri-wallet-fill', label: 'Wallet' },
  { path: '/profile', icon: 'ri-user-line', activeIcon: 'ri-user-fill', label: 'Profile' }
];

export default function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-0 py-2 z-50">
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center space-y-1 h-full"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <i className={`${isActive ? item.activeIcon : item.icon} text-lg ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`}></i>
              </div>
              <span className={`text-xs ${
                isActive ? 'text-blue-600 font-medium' : 'text-gray-500'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
