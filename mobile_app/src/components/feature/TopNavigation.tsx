
interface TopNavigationProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export default function TopNavigation({ title, showBack = false, onBack, rightAction }: TopNavigationProps) {
  return (
    <div className="fixed top-0 left-0 right-0 bg-navy-900 border-b border-navy-800 px-4 py-3 z-50" style={{ backgroundColor: '#1e3a8a' }}>
      <div className="flex items-center justify-between h-10">
        <div className="flex items-center">
          {showBack && (
            <button onClick={onBack} className="mr-3 p-1">
              <i className="ri-arrow-left-line text-xl text-white"></i>
            </button>
          )}
          <h1 className="text-lg font-semibold text-white">{title}</h1>
        </div>
        {rightAction && (
          <div className="flex items-center">
            {rightAction}
          </div>
        )}
      </div>
    </div>
  );
}
