import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Opportunity } from '../types/opportunity';

interface OpportunityTableProps {
  opportunities: Opportunity[];
  accountNames: Map<string, string>; // Map of accountId -> accountName
  userNames: Map<string, string>; // Map of userId -> user display name
  onEdit: (o: Opportunity) => void;
  onDelete: (o: Opportunity) => void;
}

export default function OpportunityTable({ opportunities, accountNames, userNames, onEdit, onDelete }: OpportunityTableProps) {
  const navigate = useNavigate();
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

  // Group opportunities by accountId
  const groupedOpportunities = new Map<string | null, Opportunity[]>();
  opportunities.forEach(opp => {
    const accountId = opp.accountId || null;
    if (!groupedOpportunities.has(accountId)) {
      groupedOpportunities.set(accountId, []);
    }
    groupedOpportunities.get(accountId)!.push(opp);
  });

  // Sort groups: first by account name (null/No Account last), then by opportunity name
  const sortedGroups = Array.from(groupedOpportunities.entries()).sort(([accountIdA], [accountIdB]) => {
    if (accountIdA === null && accountIdB === null) return 0;
    if (accountIdA === null) return 1; // No Account goes last
    if (accountIdB === null) return -1;
    const nameA = accountNames.get(accountIdA) || accountIdA;
    const nameB = accountNames.get(accountIdB) || accountIdB;
    return nameA.localeCompare(nameB);
  });

  // Sort opportunities within each group by name
  sortedGroups.forEach(([, opps]) => {
    opps.sort((a, b) => a.name.localeCompare(b.name));
  });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          {/* Header Row 1: Name, Close Date, Amount, Stage */}
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 w-[40%]">Name</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">Close Date</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">Amount</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">Stage</th>
          </tr>
          {/* Header Row 2: Probability, Owned By, Actions */}
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 w-[40%]"></th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">Probability</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">Owned By</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedGroups.map(([accountId, accountOpportunities]) => {
            const accountName = accountId ? (accountNames.get(accountId) || accountId) : 'No Account';
            return (
              <React.Fragment key={accountId || 'no-account'}>
                {/* Account Header */}
                <tr className="bg-gray-100 dark:bg-gray-800 border-b-2 border-gray-300 dark:border-gray-600">
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white text-left">
                    {accountName}
                  </td>
                </tr>
                {/* Opportunities for this account */}
                {accountOpportunities.map(opportunity => (
                  <React.Fragment key={opportunity.id}>
                    {/* Row 1: Name, Close Date, Amount, Stage */}
                    <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-4 py-2 text-sm text-left w-[40%]">
                        <button 
                          onClick={() => handleNameClick(opportunity)} 
                          className="text-brand-500 hover:text-brand-600 hover:underline font-medium dark:text-brand-400 text-left"
                        >
                          {opportunity.name}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 text-left">
                        {formatDate(opportunity.expectedCloseDate)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-left">{formatCurrency(opportunity.amount)}</td>
                      <td className="px-4 py-2 text-sm text-left">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300">
                          {opportunity.stage}
                        </span>
                      </td>
                    </tr>
                    {/* Row 2: Probability, Owned By, Actions */}
                    <tr className="border-b-2 border-gray-400 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-left w-[40%]"></td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-left">{opportunity.probability ? `${opportunity.probability}%` : '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-left">
                        {userNames.get(opportunity.owner) || opportunity.owner}
                      </td>
                      <td className="px-4 py-2 text-sm text-left">
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
                  </React.Fragment>
                ))}
              </React.Fragment>
            );
          })}
          {opportunities.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-left text-gray-500 dark:text-gray-400">
                No opportunities found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
