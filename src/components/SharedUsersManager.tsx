import { useState, useEffect } from 'react';
import type { SharedUser } from '../types/account';
import type { User } from '../types/user';
import { userService } from '../services/userService';

interface SharedUsersManagerProps {
  sharedUsers: SharedUser[];
  onSharedUsersChange: (sharedUsers: SharedUser[]) => void;
  disabled?: boolean;
  currentUserId: string; // To exclude current user from the list
}

export function SharedUsersManager({
  sharedUsers,
  onSharedUsersChange,
  disabled = false,
  currentUserId,
}: SharedUsersManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedPermission, setSelectedPermission] = useState<'view' | 'edit'>('view');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        const usersData = await userService.getAll();
        setAllUsers(usersData);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const getUserName = (userId: string): string => {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      return user.displayName || 
             (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : '') ||
             user.email;
    }
    return userId;
  };

  // Get available users (excluding current user and already shared users)
  const availableUsers = allUsers.filter(
    user => user.id !== currentUserId && !sharedUsers.some(su => su.userId === user.id)
  );

  const handleAddUser = () => {
    if (!selectedUserId || disabled) return;

    const newSharedUser: SharedUser = {
      userId: selectedUserId,
      permission: selectedPermission,
    };

    onSharedUsersChange([...sharedUsers, newSharedUser]);
    setSelectedUserId('');
    setSelectedPermission('view');
  };

  const handleRemoveUser = (userId: string) => {
    if (disabled) return;
    onSharedUsersChange(sharedUsers.filter(su => su.userId !== userId));
  };

  const handlePermissionChange = (userId: string, permission: 'view' | 'edit') => {
    if (disabled) return;
    onSharedUsersChange(
      sharedUsers.map(su => 
        su.userId === userId ? { ...su, permission } : su
      )
    );
  };

  return (
    <>
      {/* Button to open modal */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
        title="Manage shared users"
      >
        Shared Users {sharedUsers.length > 0 && `(${sharedUsers.length})`}
      </button>

      {/* Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 flex justify-center items-center z-50"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-lg w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Shared Users</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
                title="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 6L14 14M6 14L14 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {/* List of shared users */}
              {sharedUsers.length > 0 ? (
                <div className="space-y-2">
                  {sharedUsers.map((sharedUser) => (
                    <div
                      key={sharedUser.userId}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {getUserName(sharedUser.userId)}
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          value={sharedUser.permission}
                          onChange={(e) => handlePermissionChange(sharedUser.userId, e.target.value as 'view' | 'edit')}
                          disabled={disabled}
                          className="text-xs rounded border border-gray-300 dark:border-gray-600 px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-700"
                        >
                          <option value="view">View Only</option>
                          <option value="edit">Edit</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveUser(sharedUser.userId)}
                          disabled={disabled}
                          className="text-error-500 hover:text-error-600 dark:text-error-400 disabled:opacity-50"
                          title="Remove user"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No users shared yet.
                </p>
              )}

              {/* Add new user */}
              {!disabled && availableUsers.length > 0 && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                    >
                      <option value="">Select a user...</option>
                      {availableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.displayName || 
                           (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : '') ||
                           user.email}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedPermission}
                      onChange={(e) => setSelectedPermission(e.target.value as 'view' | 'edit')}
                      className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                    >
                      <option value="view">View Only</option>
                      <option value="edit">Edit</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddUser}
                      disabled={!selectedUserId || loading}
                      className="px-3 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {!disabled && availableUsers.length === 0 && sharedUsers.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No other users available to share with.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

