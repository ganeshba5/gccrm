import { useState, useEffect } from 'react';
import type { Opportunity } from '../types/opportunity';
import { accountService } from '../services/accountService';
// Account type removed - not used in this component

interface OpportunityProfilePanelProps {
  opportunity: Opportunity | null;
  onClose: () => void;
  userNames?: Map<string, string>; // Map of userId -> user display name
}

export default function OpportunityProfilePanel({ opportunity, onClose, userNames }: OpportunityProfilePanelProps) {
  const [accountName, setAccountName] = useState<string | null>(null);

  useEffect(() => {
    if (opportunity?.accountId) {
      accountService.getById(opportunity.accountId)
        .then(account => {
          if (account) {
            setAccountName(account.name);
          }
        })
        .catch(err => {
          console.error('Error fetching account:', err);
        });
    } else {
      setAccountName(null);
    }
  }, [opportunity?.accountId]);

  if (!opportunity) return null;

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{opportunity.name}</h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Close
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Stage</span>
            <div className="text-sm text-gray-900 dark:text-white">{opportunity.stage}</div>
          </div>
          {opportunity.accountId && (
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Account</span>
              <div className="text-sm text-gray-900 dark:text-white">
                {accountName || opportunity.accountId}
              </div>
            </div>
          )}
          {opportunity.amount && (
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Amount</span>
              <div className="text-sm text-gray-900 dark:text-white">{formatCurrency(opportunity.amount)}</div>
            </div>
          )}
          {opportunity.probability && (
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Probability</span>
              <div className="text-sm text-gray-900 dark:text-white">{opportunity.probability}%</div>
            </div>
          )}
          {opportunity.expectedCloseDate && (
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Expected Close Date</span>
              <div className="text-sm text-gray-900 dark:text-white">{formatDate(opportunity.expectedCloseDate)}</div>
            </div>
          )}
          {opportunity.description && (
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Description</span>
              <div className="text-sm text-gray-900 dark:text-white">{opportunity.description}</div>
            </div>
          )}
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Owner</span>
            <div className="text-sm text-gray-900 dark:text-white">
              {userNames?.get(opportunity.owner) || opportunity.owner}
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Created</span>
            <div className="text-sm text-gray-900 dark:text-white">
              {new Date(opportunity.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

