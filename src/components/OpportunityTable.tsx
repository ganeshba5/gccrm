import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Opportunity } from '../types/opportunity';
import { useAuth } from '../context/AuthContext';
import { canAccessAllData } from '../lib/auth-helpers';
import { accountService } from '../services/accountService';

interface OpportunityTableProps {
  opportunities: Opportunity[];
  accountNames: Map<string, string>; // Map of accountId -> accountName
  userNames: Map<string, string>; // Map of userId -> user display name
  onEdit: (o: Opportunity) => void;
  onDelete: (o: Opportunity) => void;
}

export default function OpportunityTable({ opportunities, accountNames, userNames, onEdit, onDelete }: OpportunityTableProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleNameClick = (opportunity: Opportunity) => {
    onEdit(opportunity);
  };

  const handleDelete = (e: React.MouseEvent, opportunity: Opportunity) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${opportunity.name}"?`)) {
      onDelete(opportunity);
    }
  };

  const handleAccountClick = async (accountId: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!accountId || !user) return;
    
    try {
      // Check permissions for this account
      const isAdmin = await canAccessAllData();
      const account = await accountService.getById(accountId);
      
      if (account) {
        // Admin can always edit, or user created the account
        const canEdit = isAdmin || account.createdBy === user.id;
        
        // Navigate to edit or view mode based on permissions
        if (canEdit) {
          navigate(`/accounts/${accountId}/edit?from=opportunities`);
        } else {
          navigate(`/accounts/${accountId}/view?from=opportunities`);
        }
      } else {
        // If account not found, default to view mode
        navigate(`/accounts/${accountId}/view?from=opportunities`);
      }
    } catch (err) {
      console.error('Error checking account permissions:', err);
      // On error, default to view mode
      navigate(`/accounts/${accountId}/view?from=opportunities`);
    }
  };

  // Sort opportunities by name
  // All opportunities should have valid names at this point (set in OpportunityDashboard)
  const sortedOpportunities = [...opportunities].sort((a, b) => {
    const nameA = a.name || '';
    const nameB = b.name || '';
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="overflow-x-auto">
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Account Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Opportunity Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Value</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stage</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Close Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedOpportunities.map((opportunity) => {
              // Get account name - never show the ID, use "Unnamed Account" as fallback
              const accountName = opportunity.accountId 
                ? (accountNames.get(opportunity.accountId) || 'Unnamed Account') 
                : 'No Account';
              
              // Display name - ensure it's never the ID (fallback to "Unnamed Opportunity" if needed)
              const displayName = opportunity.name && opportunity.name !== opportunity.id
                ? opportunity.name
                : 'Unnamed Opportunity';
              
              return (
                <tr key={opportunity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {opportunity.accountId ? (
                      <button
                        onClick={(e) => handleAccountClick(opportunity.accountId!, e)}
                        className="text-brand-500 hover:text-brand-600 hover:underline dark:text-brand-400 text-left"
                        title="Click to view/edit account"
                      >
                        {accountName}
                      </button>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">{accountName}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button 
                      onClick={() => handleNameClick(opportunity)} 
                      className="text-brand-500 hover:text-brand-600 hover:underline font-medium dark:text-brand-400 text-left"
                    >
                      {displayName}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    {formatCurrency(opportunity.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300">
                      {opportunity.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(opportunity.expectedCloseDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-1.5 flex-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/opportunities/${opportunity.id}/notes`);
                        }}
                        className="p-1.5 text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500/10 rounded transition-colors flex-shrink-0"
                        title="Notes"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/opportunities/${opportunity.id}/tasks`);
                        }}
                        className="p-1.5 text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500/10 rounded transition-colors flex-shrink-0"
                        title="Tasks"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, opportunity)}
                        className="p-1.5 text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 rounded transition-colors flex-shrink-0"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sortedOpportunities.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  No opportunities found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
