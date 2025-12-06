import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Account } from '../types/account';
import type { Opportunity } from '../types/opportunity';
import { accountService } from '../services/accountService';
import { opportunityService } from '../services/opportunityService';
import { configSettingService } from '../services/configSettingService';
import { useAuth } from '../context/AuthContext';
import { canAccessAllData } from '../lib/auth-helpers';

export function AccountList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountEditPermissions, setAccountEditPermissions] = useState<Map<string, boolean>>(new Map());
  const [accountSearch, setAccountSearch] = useState<string>('');
  const [accountFocused, setAccountFocused] = useState<boolean>(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [viewHistoryFrom, setViewHistoryFrom] = useState<Date | null>(null);

  useEffect(() => {
    loadAccounts();
    loadOpportunities();
    loadViewHistoryFrom();
  }, []);

  // Load opportunities to count visible ones per account
  const loadOpportunities = async () => {
    try {
      const opps = await opportunityService.getAll();
      setOpportunities(opps);
    } catch (err) {
      console.error('Error loading opportunities:', err);
    }
  };

  // Load view_history_from config setting
  const loadViewHistoryFrom = async () => {
    try {
      const setting = await configSettingService.getConfigValue<string | number>('opportunities.view_history_from');
      if (setting !== null) {
        let cutoffDate: Date;
        if (typeof setting === 'number') {
          // If it's a year, set to January 1st of that year
          cutoffDate = new Date(setting, 0, 1);
        } else {
          // If it's a string, try to parse it as a date
          cutoffDate = new Date(setting);
          if (isNaN(cutoffDate.getTime())) {
            // If parsing fails, try as year
            const year = parseInt(setting, 10);
            if (!isNaN(year)) {
              cutoffDate = new Date(year, 0, 1);
            } else {
              console.warn('Invalid view_history_from setting:', setting);
              return;
            }
          }
        }
        setViewHistoryFrom(cutoffDate);
      }
    } catch (error) {
      console.error('Error loading view_history_from setting:', error);
    }
  };

  // Get count of visible opportunities for an account
  const getVisibleOpportunityCount = (accountId: string): number => {
    return opportunities.filter(opp => {
      // Only count opportunities linked to this account
      if (opp.accountId !== accountId) return false;
      
      // Apply view_history_from filter
      if (viewHistoryFrom && opp.expectedCloseDate) {
        const oppDate = new Date(opp.expectedCloseDate);
        oppDate.setHours(0, 0, 0, 0);
        const cutoffDate = new Date(viewHistoryFrom);
        cutoffDate.setHours(0, 0, 0, 0);
        
        if (oppDate < cutoffDate) {
          return false; // Exclude opportunities older than view_history_from
        }
      }
      
      return true;
    }).length;
  };

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

  const filteredAccounts = accounts.filter((account) => {
    // First apply search filter
    const matchesSearch = account.name.toLowerCase().includes(accountSearch.toLowerCase());
    
    // If there's an explicit search, show the account even if it has 0 opportunities
    if (accountSearch.trim() !== '') {
      return matchesSearch;
    }
    
    // If no search, only show accounts with at least 1 visible opportunity
    const visibleOppCount = getVisibleOpportunityCount(account.id);
    return matchesSearch && visibleOppCount > 0;
  });

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
      {/* Account search combo box */}
      <div className="max-w-xs">
        <div className="relative">
          <input
            type="text"
            value={accountSearch}
            onChange={(e) => setAccountSearch(e.target.value)}
            onFocus={() => setAccountFocused(true)}
            onBlur={() => {
              setTimeout(() => setAccountFocused(false), 200);
            }}
            placeholder="Search Accounts"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
          />
          {accountFocused && (accountSearch === '' || accounts.some(account => 
            account.name.toLowerCase().includes(accountSearch.toLowerCase())
          )) && (
            <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => setAccountSearch('')}
              >
                All Accounts
              </button>
              {accounts
                .filter((account) =>
                  accountSearch === '' || account.name.toLowerCase().includes(accountSearch.toLowerCase())
                )
                .slice(0, 20)
                .map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => setAccountSearch(account.name)}
                  >
                    {account.name}
                  </button>
                ))}
            </div>
          )}
        </div>
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
            {filteredAccounts.map((account) => (
              <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-left">
                  <button
                    onClick={() => {
                      const canEdit = accountEditPermissions.get(account.id);
                      if (canEdit) {
                        navigate(`/accounts/${account.id}/edit`);
                      } else {
                        navigate(`/accounts/${account.id}/view`);
                      }
                    }}
                    className="text-sm font-medium text-brand-500 hover:text-brand-600 hover:underline text-left"
                  >
                    {account.name}
                  </button>
                  {account.email && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 text-left">{account.email}</div>
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

