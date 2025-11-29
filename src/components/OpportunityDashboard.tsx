import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import OpportunityTable from './OpportunityTable';
// OpportunityProfilePanel removed - EditOpportunityModal is used instead
import AddOpportunityModal from './AddOpportunityModal';
import EditOpportunityModal from './EditOpportunityModal';
import { useAuth } from '../context/AuthContext';
import type { Opportunity } from '../types/opportunity';
import type { Account } from '../types/account';
// User type removed - not directly used in this component
import { opportunityService } from '../services/opportunityService';
import { accountService } from '../services/accountService';
import { userService } from '../services/userService';
import DatePicker from './DatePicker';
// canAccessAllData removed - not used in this component

export default function OpportunityDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  // const [users] = useState<any[]>([]); // Reserved for future use
  const [accountNames, setAccountNames] = useState<Map<string, string>>(new Map());
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  // selectedOpportunity removed - using opportunityToEdit instead
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [opportunityToEdit, setOpportunityToEdit] = useState<Opportunity | null>(null);
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [accountSearch, setAccountSearch] = useState<string>('');
  const [dateFilterType, setDateFilterType] = useState<string>('all'); // 'all', 'month', 'quarter', 'year', 'custom'
  const [dateFilterValue, setDateFilterValue] = useState<string>(''); // For month, quarter, year selections
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const { user, loading: authLoading } = useAuth();

  // Check for 'new' query parameter to open add modal
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setIsAddOpen(true);
      // Remove the query parameter from URL
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const fetchAccounts = async () => {
    try {
      if (!user) return;
      
      // Get all opportunities first (already filtered by owner for non-admin)
      const allOpportunities = await opportunityService.getAll();
      
      // Extract unique account IDs from opportunities
      const accountIds = new Set(
        allOpportunities
          .filter(opp => opp.accountId)
          .map(opp => opp.accountId!)
      );
      
      // Fetch account details for each accountId to build the names map
      const accountPromises = Array.from(accountIds).map(accountId =>
        accountService.getById(accountId).catch(() => null)
      );
      const accountResults = await Promise.all(accountPromises);
      const accountsData = accountResults.filter((account): account is Account => account !== null);
      
      // Create a map of accountId -> accountName
      const namesMap = new Map<string, string>();
      accountsData.forEach(account => {
        namesMap.set(account.id, account.name);
      });
      
      // For accounts that couldn't be fetched, keep the accountId as fallback
      accountIds.forEach(accountId => {
        if (!namesMap.has(accountId)) {
          // Will be handled by OpportunityTable which shows accountId as fallback
        }
      });
      
      setAccounts(accountsData);
      setAccountNames(namesMap);
    } catch (err: any) {
      console.error('Error fetching accounts:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const usersData = await userService.getAll();
      // setUsers(usersData); // Reserved for future use
      
      // Create a map of userId -> user display name (or email if no display name)
      const namesMap = new Map<string, string>();
      usersData.forEach(user => {
        const displayName = user.displayName || 
                          (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null) ||
                          user.email;
        namesMap.set(user.id, displayName);
      });
      setUserNames(namesMap);
    } catch (err: any) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchOpportunities = async () => {
    try {
      if (!user) {
        console.warn('No user authenticated, cannot fetch opportunities');
        return;
      }

      const opportunities = await opportunityService.getAll();
      setOpportunities(opportunities);
    } catch (err: any) {
      console.error('Fetch opportunities failed', err);
      if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') {
        console.warn('Permission denied - cannot fetch opportunities');
        setOpportunities([]);
      } else {
        console.error('Error fetching opportunities:', err.message || err);
      }
    }
  };

  const refreshOpportunities = async () => {
    await fetchOpportunities();
  };

  const handleEdit = (opportunity: Opportunity) => {
    setOpportunityToEdit(opportunity);
    setIsEditOpen(true);
  };

  const handleDelete = async (opportunity: Opportunity) => {
    try {
      if (!opportunity.id) {
        console.error('Opportunity has no ID');
        return;
      }

      await opportunityService.delete(opportunity.id);
      await refreshOpportunities();
    } catch (err: any) {
      console.error('Failed to delete opportunity:', err);
      alert(`Failed to delete opportunity: ${err.message || 'Unknown error'}`);
    }
  };

  const handleEditUpdate = async () => {
    setTimeout(async () => {
      await refreshOpportunities();
    }, 500);
    setIsEditOpen(false);
    setOpportunityToEdit(null);
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }
    
    if (!user) {
      return;
    }
    
    fetchAccounts();
    fetchUsers();
    fetchOpportunities();
  }, [user, authLoading]);

  // Helper function to check if a date falls within a date range
  const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean => {
    return date >= startDate && date <= endDate;
  };

  // Helper function to get date range based on filter type
  const getDateRange = (): { start: Date | null; end: Date | null } => {
    if (dateFilterType === 'all') {
      return { start: null, end: null };
    }

    // const now = new Date(); // Not used in this function
    let start: Date;
    let end: Date;

    if (dateFilterType === 'month') {
      // Format: "YYYY-MM" (e.g., "2024-01")
      const [year, month] = dateFilterValue.split('-').map(Number);
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month
    } else if (dateFilterType === 'quarter') {
      // Format: "YYYY-Q" (e.g., "2024-1" for Q1)
      const [year, quarter] = dateFilterValue.split('-').map(Number);
      const startMonth = (quarter - 1) * 3;
      start = new Date(year, startMonth, 1);
      end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999); // Last day of quarter
    } else if (dateFilterType === 'year') {
      // Format: "YYYY" (e.g., "2024")
      const year = Number(dateFilterValue);
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31, 23, 59, 59, 999);
    } else if (dateFilterType === 'custom') {
      if (customStartDate && customEndDate) {
        start = new Date(customStartDate);
        end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
      } else {
        return { start: null, end: null };
      }
    } else {
      return { start: null, end: null };
    }

    return { start, end };
  };

  // Generate month options (up to 3 months prior)
  const getMonthOptions = (): string[] => {
    const options: string[] = [];
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push(`${year}-${month}|${monthName}`);
    }
    return options;
  };

  // Generate quarter options (current year and previous year)
  const getQuarterOptions = (): string[] => {
    const options: string[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    
    // Current year quarters up to current quarter
    for (let q = 1; q <= currentQuarter; q++) {
      options.push(`${currentYear}-${q}|Q${q} ${currentYear}`);
    }
    
    // Previous year all quarters
    for (let q = 1; q <= 4; q++) {
      options.push(`${currentYear - 1}-${q}|Q${q} ${currentYear - 1}`);
    }
    
    return options;
  };

  // Generate year options (current year and previous 2 years)
  const getYearOptions = (): string[] => {
    const options: string[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    for (let i = 0; i < 3; i++) {
      const year = currentYear - i;
      options.push(`${year}|${year}`);
    }
    return options;
  };

  // Filter opportunities
  const filteredOpportunities = opportunities.filter(opp => {
    // Stage filter
    if (filterStage !== 'all' && opp.stage !== filterStage) return false;
    
    // Account filter
    if (filterAccount !== 'all' && opp.accountId !== filterAccount) return false;
    
    // Date filter (filter by expectedCloseDate)
    if (dateFilterType !== 'all') {
      const { start, end } = getDateRange();
      if (start && end) {
        // Only filter if opportunity has an expectedCloseDate
        if (!opp.expectedCloseDate) return false; // Exclude opportunities without close date
        
        const oppDate = new Date(opp.expectedCloseDate);
        if (!isDateInRange(oppDate, start, end)) return false;
      }
    }
    
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Filters and View Options */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select 
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
          >
            <option value="all">All Stages</option>
            <option value="New">New</option>
            <option value="Qualified">Qualified</option>
            <option value="Proposal">Proposal</option>
            <option value="Negotiation">Negotiation</option>
            <option value="Closed Won">Closed Won</option>
            <option value="Closed Lost">Closed Lost</option>
          </select>
          {/* Account combo box */}
          <div className="relative">
            <input
              type="text"
              value={accountSearch}
              onChange={(e) => {
                const value = e.target.value;
                setAccountSearch(value);
                // If exact match, set filterAccount, otherwise show all
                const match = accounts.find(
                  (account) => account.name.toLowerCase() === value.toLowerCase()
                );
                setFilterAccount(match ? match.id : 'all');
              }}
              placeholder="All Accounts"
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 min-w-[200px]"
            />
            {accountSearch && (
              <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => {
                    setAccountSearch('');
                    setFilterAccount('all');
                  }}
                >
                  All Accounts
                </button>
                {accounts
                  .filter((account) =>
                    account.name.toLowerCase().includes(accountSearch.toLowerCase())
                  )
                  .slice(0, 20)
                  .map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                      onClick={() => {
                        setAccountSearch(account.name);
                        setFilterAccount(account.id);
                      }}
                    >
                      {account.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
          <select
            value={dateFilterType}
            onChange={(e) => {
              setDateFilterType(e.target.value);
              setDateFilterValue('');
              setCustomStartDate('');
              setCustomEndDate('');
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
          >
            <option value="all">All Dates</option>
            <option value="month">By Month</option>
            <option value="quarter">By Quarter</option>
            <option value="year">By Year</option>
            <option value="custom">Custom Range</option>
          </select>
          {dateFilterType === 'month' && (
            <select
              value={dateFilterValue}
              onChange={(e) => setDateFilterValue(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
            >
              <option value="">Select Month</option>
              {getMonthOptions().map(option => {
                const [value, label] = option.split('|');
                return <option key={value} value={value}>{label}</option>;
              })}
            </select>
          )}
          {dateFilterType === 'quarter' && (
            <select
              value={dateFilterValue}
              onChange={(e) => setDateFilterValue(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
            >
              <option value="">Select Quarter</option>
              {getQuarterOptions().map(option => {
                const [value, label] = option.split('|');
                return <option key={value} value={value}>{label}</option>;
              })}
            </select>
          )}
          {dateFilterType === 'year' && (
            <select
              value={dateFilterValue}
              onChange={(e) => setDateFilterValue(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
            >
              <option value="">Select Year</option>
              {getYearOptions().map(option => {
                const [value, label] = option.split('|');
                return <option key={value} value={value}>{label}</option>;
              })}
            </select>
          )}
          {dateFilterType === 'custom' && (
            <div className="flex items-center gap-2">
              <DatePicker
                value={customStartDate}
                onChange={setCustomStartDate}
                placeholder="Start Date"
                className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
              />
              <span className="text-gray-500 dark:text-gray-400">to</span>
              <DatePicker
                value={customEndDate}
                onChange={setCustomEndDate}
                placeholder="End Date"
                className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
              />
            </div>
          )}
          <input
            type="text"
            placeholder="Search..."
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(dateFilterType !== 'all' || filterStage !== 'all' || filterAccount !== 'all') && (
              <button
                onClick={() => {
                  setFilterStage('all');
                  setFilterAccount('all');
                  setAccountSearch('');
                  setDateFilterType('all');
                  setDateFilterValue('');
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
              >
                Clear Filters
              </button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">{filteredOpportunities.length} results</span>
          </div>
        </div>
      </div>

      {/* Main Content Table */}
      <div>
        <OpportunityTable 
          opportunities={filteredOpportunities} 
          accountNames={accountNames}
          userNames={userNames}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
      <AddOpportunityModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreate={async () => { 
          setTimeout(async () => {
            await refreshOpportunities(); 
          }, 500);
          setIsAddOpen(false); 
        }}
      />
      <EditOpportunityModal
        open={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setOpportunityToEdit(null);
        }}
        onUpdate={handleEditUpdate}
        opportunity={opportunityToEdit}
      />
    </div>
  );
}

