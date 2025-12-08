import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfileModal } from './UserProfileModal';
import { canAccessAllData } from '../lib/auth-helpers';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAdminExpanded, setIsAdminExpanded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleProfileUpdate = () => {
    // Refresh the page to get updated user data
    window.location.reload();
  };

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      const adminStatus = await canAccessAllData();
      setIsAdmin(adminStatus);
    };
    if (user) {
      checkAdmin();
    }
  }, [user]);

  // Auto-expand sections if their items are active
  useEffect(() => {
    const adminActive = adminMenuItems.some(item => isActive(item.path));
    
    if (isAdmin && adminActive) {
      setIsAdminExpanded(true);
    }
  }, [location.pathname, isAdmin]);

  const getPageMeta = () => {
    const path = location.pathname;
    if (path.startsWith('/opportunities') || path.startsWith('/leads')) {
      return { icon: '💼', title: 'Opportunities' };
    }
    if (path.startsWith('/accounts') || path.startsWith('/customers')) {
      return { icon: '🏢', title: 'Accounts' };
    }
    if (path.startsWith('/contacts')) {
      return { icon: '📇', title: 'Contacts' };
    }
    if (path.startsWith('/tasks')) {
      return { icon: '✅', title: 'Tasks' };
    }
    if (path.startsWith('/notes')) {
      return { icon: '📝', title: 'Notes' };
    }
    if (path.startsWith('/users')) {
      return { icon: '👤', title: 'Users' };
    }
    if (path.startsWith('/emails')) {
      return { icon: '📧', title: 'Emails' };
    }
    if (path.startsWith('/settings')) {
      return { icon: '⚙️', title: 'Settings' };
    }
    return { icon: '📊', title: 'Home' };
  };

  const getPrimaryAction = () => {
    const path = location.pathname;
    if (path.startsWith('/opportunities') || path.startsWith('/leads')) {
      return { label: '+ New Opportunity', to: '/opportunities' };
    }
    if (path.startsWith('/accounts') || path.startsWith('/customers')) {
      return { label: '+ New Account', to: '/accounts/new' };
    }
    if (path.startsWith('/contacts')) {
      return { label: '+ New Contact', to: '/contacts/new' };
    }
    if (path.startsWith('/tasks')) {
      return { label: '+ New Task', to: '/tasks/new' };
    }
    if (path.startsWith('/notes')) {
      return { label: '+ New Note', to: '/notes/new' };
    }
    if (path.startsWith('/users')) {
      return { label: '+ New User', to: '/users/new' };
    }
    if (path.startsWith('/emails')) {
      return null; // No create action for emails
    }
    if (path.startsWith('/settings')) {
      return { label: '+ New Setting', to: '/settings?new=true' };
    }
    return null;
  };

  // Main menu items (always visible, in order)
  const mainMenuItems = [
    { path: '/dashboard', label: 'Home', icon: '📊' },
    { path: '/accounts', label: 'Accounts', icon: '🏢' },
    { path: '/opportunities', label: 'Opportunities', icon: '💼' },
    { path: '/contacts', label: 'Contacts', icon: '📇' },
    { path: '/tasks', label: 'Tasks', icon: '✅' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  // Admin menu items (collapsible, admin only)
  const adminMenuItems = [
    { path: '/users', label: 'Users', icon: '👤' },
    { path: '/emails', label: 'Emails', icon: '📧' },
  ];

  // Check if any item in a group is active
  const isGroupActive = (items: typeof adminMenuItems) => {
    return items.some(item => isActive(item.path));
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    // Handle legacy routes
    if (path === '/opportunities') {
      return location.pathname.startsWith('/opportunities') || location.pathname.startsWith('/leads');
    }
    if (path === '/accounts') {
      return location.pathname.startsWith('/accounts') || location.pathname.startsWith('/customers');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar with fixed page title */}
      <header className="sticky top-0 flex w-full bg-white border-gray-200 z-99999 dark:border-gray-800 dark:bg-gray-900 border-b">
        <div className="flex items-center justify-between w-full px-4 py-3 lg:px-6 lg:py-4">
          <div className="flex items-center gap-3">
            {/* Hamburger menu button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isSidebarOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <span className="text-2xl lg:text-3xl">{getPageMeta().icon}</span>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
              {getPageMeta().title}
            </h1>
          </div>
          {/* Right side: primary action + user info */}
          <div className="flex items-center gap-4">
            {getPrimaryAction() && (
              <button
                onClick={() => {
                  const action = getPrimaryAction();
                  if (action) {
                    // For opportunities, add query parameter to trigger modal
                    if (action.to === '/opportunities') {
                      navigate('/opportunities?new=true');
                    } else {
                      navigate(action.to);
                    }
                  }
                }}
                className="hidden sm:inline-flex bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-theme-sm transition-colors"
              >
                {getPrimaryAction()!.label}
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {user?.displayName || user?.email || 'User'}
              </span>
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="p-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                title="Edit Profile"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Backdrop overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-99998 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Floating Sidebar - overlay */}
      <aside
        className={`fixed top-[64px] left-0 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 text-gray-900 flex flex-col h-[calc(100vh-64px)] z-99999 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } shadow-theme-lg`}
      >
        {/* Navigation */}
        <nav className="flex-1 p-5 space-y-1 overflow-y-auto custom-scrollbar">
          {/* Main Menu Items */}
          {mainMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsSidebarOpen(false)}
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

          {/* Admin Menu (Collapsible, Admin Only) */}
          {isAdmin && (
            <div className="mt-2">
              <button
                onClick={() => setIsAdminExpanded(!isAdminExpanded)}
                className={`menu-item group w-full flex items-center justify-between ${
                  isGroupActive(adminMenuItems) ? 'menu-item-active' : 'menu-item-inactive'
                }`}
              >
                <div className="flex items-center">
                  <span className={`menu-item-icon-size ${
                    isGroupActive(adminMenuItems) ? 'menu-item-icon-active' : 'menu-item-icon-inactive'
                  }`}>
                    <span className="text-xl">🔐</span>
                  </span>
                  <span className="font-medium">Admin</span>
                </div>
                <svg
                  className={`w-4 h-4 transition-transform ${isAdminExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isAdminExpanded && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                  {adminMenuItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsSidebarOpen(false)}
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
                </div>
              )}
            </div>
          )}
        </nav>
      </aside>

      {/* Main Content - scrollable */}
      <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        {children}
      </main>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onUpdate={handleProfileUpdate}
      />
    </div>
  );
}

