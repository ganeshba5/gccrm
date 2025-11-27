import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [searchValue, setSearchValue] = useState('');

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleGo = () => {
    // Handle search/navigation action
    console.log('Go clicked with value:', searchValue);
  };

  const handleClear = () => {
    setSearchValue('');
  };

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/leads', label: 'Leads', icon: '👥' },
    { path: '/contacts', label: 'Contacts', icon: '📇' },
    { path: '/tasks', label: 'Tasks', icon: '✅' },
    { path: '/notes', label: 'Notes', icon: '📝' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar - Using design system */}
      <header className="sticky top-0 flex w-full bg-white border-gray-200 z-99999 dark:border-gray-800 dark:bg-gray-900 border-b">
        <div className="flex flex-col items-center justify-between grow lg:flex-row lg:px-6">
          <div className="flex items-center justify-between w-full gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-800 sm:gap-4 lg:justify-normal lg:border-b-0 lg:px-0 lg:py-4">
            {/* Two small empty square input fields */}
            <div className="flex items-center space-x-1">
              <input type="text" className="w-8 h-8 border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 rounded" />
              <input type="text" className="w-8 h-8 border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 rounded" />
            </div>
            
            {/* Search/Input Field */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Enter number or search."
                className="px-3 py-2 h-11 rounded-lg border border-gray-200 bg-transparent text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 w-64"
              />
              <button
                onClick={handleGo}
                className="px-4 py-2 h-11 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors text-sm"
              >
                Go!
              </button>
            </div>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-4 px-5 py-4 lg:px-0">
            <span className="text-sm text-gray-700 dark:text-gray-300">{user?.email || 'User'}</span>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Using design system */}
        <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 text-gray-900 flex flex-col">
          {/* Navigation */}
          <nav className="flex-1 p-5 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`menu-item group ${
                  isActive(item.path) ? 'menu-item-active' : 'menu-item-inactive'
                }`}
              >
                <span className={`menu-item-icon-size ${
                  isActive(item.path) ? 'menu-item-icon-active' : 'menu-item-icon-inactive'
                }`}>
                  <span className="text-xl">{item.icon}</span>
                </span>
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}

