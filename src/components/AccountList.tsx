import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Account } from '../types/account';
import { accountService } from '../services/accountService';
import { opportunityService } from '../services/opportunityService';
import { useAuth } from '../context/AuthContext';
import { canAccessAllData } from '../lib/auth-helpers';

export function AccountList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountEditPermissions, setAccountEditPermissions] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await accountService.getAll();
      setAccounts(data);
      setError(null);

      // Check edit permissions for each account
      if (user) {
        const isAdmin = await canAccessAllData();
        const permissions = new Map<string, boolean>();

        for (const account of data) {
          if (isAdmin) {
            permissions.set(account.id, true);
          } else {
            // Non-admin can only edit accounts they created
            const canEdit = account.createdBy === user.id;
            permissions.set(account.id, canEdit);
          }
        }

        setAccountEditPermissions(permissions);
      }
    } catch (err) {
      setError('Failed to load accounts');
      console.error('Error loading accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading accounts...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        {error}
        <button 
          onClick={loadAccounts}
          className="ml-4 text-blue-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <span className="text-4xl">🏢</span>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Accounts</h1>
        </div>
        <button
          className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-lg shadow-theme-sm transition-colors font-medium text-sm"
          onClick={() => navigate('/accounts/new')}
        >
          + New Account
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Industry</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {accounts.map((account) => (
              <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {account.name}
                  </div>
                  {account.email && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">{account.email}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">{account.industry || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    account.status === 'active' ? 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-400' :
                    account.status === 'inactive' ? 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-400' :
                    'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-400'
                  }`}>
                    {account.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {account.lastContact ? new Date(account.lastContact).toLocaleDateString() : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <button
                      className="p-1.5 text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500/10 rounded transition-colors"
                      onClick={() => navigate(`/accounts/${account.id}/notes`)}
                      title="Notes"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                    <button
                      className="p-1.5 text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500/10 rounded transition-colors"
                      onClick={() => navigate(`/accounts/${account.id}/tasks`)}
                      title="Tasks"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </button>
                    {/* View button - always show for non-admin users, or if user can't edit */}
                    {(!accountEditPermissions.get(account.id) || accountEditPermissions.get(account.id) === false) && (
                      <button
                        className="p-1.5 text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500/10 rounded transition-colors"
                        onClick={() => navigate(`/accounts/${account.id}/view`)}
                        title="View"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    )}
                    {/* Edit button - only show if user can edit */}
                    {accountEditPermissions.get(account.id) === true && (
                      <button
                        className="p-1.5 text-brand-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded transition-colors"
                        onClick={() => navigate(`/accounts/${account.id}/edit`)}
                        title="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    {/* Delete button - only show if user can edit */}
                    {accountEditPermissions.get(account.id) === true && (
                      <button
                        className="p-1.5 text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 rounded transition-colors"
                        onClick={async () => {
                          if (window.confirm(`Are you sure you want to delete "${account.name}"?`)) {
                            try {
                              await accountService.delete(account.id);
                              loadAccounts();
                            } catch (err) {
                              console.error('Error deleting account:', err);
                              setError('Failed to delete account');
                            }
                          }
                        }}
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {accounts.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            No accounts found
          </div>
        )}
      </div>
    </div>
  );
}

