import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import OpportunityTable from './OpportunityTable';
// OpportunityProfilePanel removed - OpportunityForm is now a route
import AddOpportunityModal from './AddOpportunityModal';
import CreateAccountModal from './CreateAccountModal';
import { useAuth } from '../context/AuthContext';
import type { Opportunity } from '../types/opportunity';
import type { Account } from '../types/account';
// User type removed - not directly used in this component
import { opportunityService } from '../services/opportunityService';
import { accountService } from '../services/accountService';
import { noteService } from '../services/noteService';
import { userService } from '../services/userService';
import { configSettingService } from '../services/configSettingService';
import NestedDateFilter from './NestedDateFilter';
// canAccessAllData removed - not used in this component

export default function OpportunityDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  // const [users] = useState<any[]>([]); // Reserved for future use
  const [accountNames, setAccountNames] = useState<Map<string, string>>(new Map());
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [accountSearch, setAccountSearch] = useState<string>('');
  const [accountFocused, setAccountFocused] = useState<boolean>(false);
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [ownerSearch, setOwnerSearch] = useState<string>('');
  const [ownerFocused, setOwnerFocused] = useState<boolean>(false);
  const [opportunityFilter, setOpportunityFilter] = useState<'all' | 'my'>('my');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [opportunityNotes, setOpportunityNotes] = useState<Map<string, string>>(new Map());
  const [notesLoading, setNotesLoading] = useState(false);
  const [dateFilterType, setDateFilterType] = useState<string>(() => {
    const saved = localStorage.getItem('opportunities_dateFilterType');
    // If no saved value, default to current year (first time use)
    if (!saved) {
      return 'year';
    }
    return saved;
  });
  const [dateFilterValue, setDateFilterValue] = useState<string>(() => {
    const saved = localStorage.getItem('opportunities_dateFilterValue');
    // If no saved value, default to current year (first time use)
    if (!saved) {
      return new Date().getFullYear().toString();
    }
    return saved;
  });
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const saved = localStorage.getItem('opportunities_customStartDate');
    return saved || '';
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const saved = localStorage.getItem('opportunities_customEndDate');
    return saved || '';
  });
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [viewHistoryFrom, setViewHistoryFrom] = useState<Date | null>(null);
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

  // No longer needed - edit is now handled by route

  // Save filter settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('opportunities_dateFilterType', dateFilterType);
  }, [dateFilterType]);

  useEffect(() => {
    localStorage.setItem('opportunities_dateFilterValue', dateFilterValue);
  }, [dateFilterValue]);

  useEffect(() => {
    localStorage.setItem('opportunities_customStartDate', customStartDate);
  }, [customStartDate]);

  useEffect(() => {
    localStorage.setItem('opportunities_customEndDate', customEndDate);
  }, [customEndDate]);

  const fetchAccounts = async () => {
    try {
      if (!user) {
        setAccountsLoaded(true);
        return;
      }
      
      setAccountsLoaded(false);
      
      // Get all accounts (not just from opportunities) for the filter dropdown
      const allAccounts = await accountService.getAll();
      setAccounts(allAccounts);
      
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
      
      setAccountNames(namesMap);
      setAccountsLoaded(true);
    } catch (err: any) {
      console.error('Error fetching accounts:', err);
      setAccountsLoaded(true);
    }
  };

  const handleAccountCreated = async (newAccount: Account) => {
    // Reload accounts list
    await fetchAccounts();
    // Set the newly created account as filter
    setAccountSearch(newAccount.name);
    setFilterAccount(newAccount.id);
    setShowCreateAccount(false);
  };

  // Check if account name doesn't exist
  const accountExists = accounts.some(
    (account) => account.name.toLowerCase() === accountSearch.toLowerCase()
  );
  const showCreateOption = accountSearch.trim() && !accountExists && accountSearch.length > 0;

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
        setLoading(false);
        return;
      }

      setLoading(true);
      const opportunities = await opportunityService.getAll();
      // Ensure all opportunities have valid names - replace invalid names with "Unnamed Opportunity"
      // This prevents the ID from appearing even briefly
      const opportunitiesWithValidNames = opportunities.map(opp => {
        if (!opp.name || opp.name.trim() === '' || opp.name === opp.id) {
          return {
            ...opp,
            name: 'Unnamed Opportunity'
          };
        }
        return opp;
      });
      setOpportunities(opportunitiesWithValidNames);
    } catch (err: any) {
      console.error('Fetch opportunities failed', err);
      if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') {
        console.warn('Permission denied - cannot fetch opportunities');
        setOpportunities([]);
      } else {
        console.error('Error fetching opportunities:', err.message || err);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshOpportunities = async () => {
    await fetchOpportunities();
  };

  // Load notes for opportunities when search term is present
  useEffect(() => {
    if (searchTerm.trim() && opportunities.length > 0) {
      const loadNotesForOpportunities = async () => {
        setNotesLoading(true);
        const notesMap = new Map<string, string>();
        try {
          await Promise.all(
            opportunities.map(async (opportunity) => {
              try {
                const notes = await noteService.getByOpportunity(opportunity.id);
                const notesContent = notes.map(n => n.content.replace(/<[^>]*>/g, '')).join(' ');
                if (notesContent) {
                  notesMap.set(opportunity.id, notesContent);
                }
              } catch (err) {
                console.error(`Error loading notes for opportunity ${opportunity.id}:`, err);
              }
            })
          );
          setOpportunityNotes(notesMap);
        } catch (err) {
          console.error('Error loading notes:', err);
        } finally {
          setNotesLoading(false);
        }
      };
      loadNotesForOpportunities();
    } else {
      setOpportunityNotes(new Map());
    }
  }, [searchTerm, opportunities]);

  const handleEdit = (opportunity: Opportunity) => {
    if (opportunity.id) {
      navigate(`/opportunities/${opportunity.id}/edit`);
    }
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

  // No longer needed - edit is now handled by route

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
    loadViewHistoryFrom();
  }, [user, authLoading]);

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

  // Generate month options (current month and next 12 months - no prior months)
  const getMonthOptions = (): string[] => {
    const options: string[] = [];
    const now = new Date();
    // Show current month and next 12 months (total 13 months, covering next 2 years)
    for (let i = 0; i < 13; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push(`${year}-${month}|${monthName}`);
    }
    return options;
  };

  // Generate quarter options (current year and next 2 years - no prior years)
  const getQuarterOptions = (): string[] => {
    const options: string[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    
    // Current year quarters from current quarter onwards
    for (let q = currentQuarter; q <= 4; q++) {
      options.push(`${currentYear}-${q}|Q${q} ${currentYear}`);
    }
    
    // Next 2 years all quarters
    for (let year = currentYear + 1; year <= currentYear + 2; year++) {
      for (let q = 1; q <= 4; q++) {
        options.push(`${year}-${q}|Q${q} ${year}`);
      }
    }
    
    return options;
  };

  // Generate year options (current year and next 2 years - no prior years)
  const getYearOptions = (): string[] => {
    const options: string[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    // Show current year and next 2 years (total 3 years)
    for (let i = 0; i < 3; i++) {
      const year = currentYear + i;
      options.push(`${year}|${year}`);
    }
    return options;
  };

  // Filter opportunities
  const filteredOpportunities = opportunities.filter(opp => {
    // OVERRIDING FILTER: View History From setting
    // This must be applied FIRST, before any other date filters
    if (viewHistoryFrom && opp.expectedCloseDate) {
      const oppDate = new Date(opp.expectedCloseDate);
      oppDate.setHours(0, 0, 0, 0);
      const cutoffDate = new Date(viewHistoryFrom);
      cutoffDate.setHours(0, 0, 0, 0);
      
      if (oppDate < cutoffDate) {
        return false; // Exclude opportunities older than view_history_from
      }
    }
    
    // My Opportunities / All Opportunities filter
    if (opportunityFilter === 'my' && user) {
      if (opp.owner !== user.id) {
        return false;
      }
    }
    
    // Stage filter
    if (filterStage !== 'all' && opp.stage !== filterStage) return false;
    
    // Account filter
    if (filterAccount !== 'all' && opp.accountId !== filterAccount) return false;
    
    // Owner filter (specific owner selection)
    if (filterOwner !== 'all' && opp.owner !== filterOwner) return false;
    
    // Search filter (Name, Description, Notes)
    if (searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      const matchesName = opp.name?.toLowerCase().includes(searchLower) || false;
      const matchesDescription = opp.description?.toLowerCase().includes(searchLower) || false;
      const notesContent = opportunityNotes.get(opp.id) || '';
      const matchesNotes = notesContent.toLowerCase().includes(searchLower);
      
      if (!matchesName && !matchesDescription && !matchesNotes) {
        return false;
      }
    }
    
    // Date filter (filter by expectedCloseDate within selected range)
    if (dateFilterType !== 'all') {
      const { start, end } = getDateRange();
      
      if (start && end) {
        // For custom date range, respect the user's explicit range selection
        // BUT still respect view_history_from override (already applied above)
        if (dateFilterType === 'custom') {
          // Only filter if opportunity has an expectedCloseDate
          if (!opp.expectedCloseDate) return false; // Exclude opportunities without close date from date range filter
          
          const oppDate = new Date(opp.expectedCloseDate);
          if (!isDateInRange(oppDate, start, end)) return false;
        } else {
          // For month/quarter/year filters, apply Expected Close Date filter: Only show opportunities where Expected Close Date >= current date OR Expected Close Date is null
          const currentDate = new Date();
          currentDate.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
          
          if (opp.expectedCloseDate) {
            const oppDate = new Date(opp.expectedCloseDate);
            oppDate.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
            // If opportunity has a close date, it must be >= current date
            if (oppDate < currentDate) return false;
          }
          // If expectedCloseDate is null, it passes the filter (we want to show null dates)
          
          // Apply the selected date range filter
          // Only filter if opportunity has an expectedCloseDate
          if (!opp.expectedCloseDate) return false; // Exclude opportunities without close date from date range filter
          
          const oppDate = new Date(opp.expectedCloseDate);
          if (!isDateInRange(oppDate, start, end)) return false;
        }
      }
    }
    // When "All Dates" is selected, show all opportunities regardless of Expected Close Date
    // BUT still respect view_history_from override (already applied above)
    
    return true;
  });

  if (loading || !accountsLoaded) {
    return <div className="p-4">Loading opportunities...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Filters and View Options */}
      <div className="mb-4 space-y-3">
        {/* My Opportunities / All Opportunities Toggle */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setOpportunityFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              opportunityFilter === 'all'
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            All Opportunities
          </button>
          <button
            onClick={() => setOpportunityFilter('my')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              opportunityFilter === 'my'
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            My Opportunities
          </button>
        </div>

        {/* Search field */}
        <div className="mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Name, Description, Notes..."
            className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
          />
          {notesLoading && searchTerm.trim() && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Loading notes...</p>
          )}
        </div>
        
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
              onFocus={() => setAccountFocused(true)}
              onBlur={() => {
                // Close dropdown when input loses focus
                // Use setTimeout to allow onClick to fire first
                setTimeout(() => {
                  setAccountFocused(false);
                  const exactMatch = accounts.find(
                    (account) => account.name.toLowerCase() === accountSearch.toLowerCase()
                  );
                  if (exactMatch) {
                    // Keep the search value if it matches
                    setAccountSearch(exactMatch.name);
                  } else if (filterAccount === 'all') {
                    // Clear search if no account is selected
                    setAccountSearch('');
                  }
                }, 200);
              }}
              placeholder="All Accounts"
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 min-w-[200px]"
            />
            {accountFocused && (accountSearch === '' || accounts.some(account => 
              account.name.toLowerCase().includes(accountSearch.toLowerCase()) &&
              account.name.toLowerCase() !== accountSearch.toLowerCase()
            ) || showCreateOption) && (
              <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    setAccountSearch('');
                    setFilterAccount('all');
                  }}
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
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur
                        setAccountSearch(account.name);
                        setFilterAccount(account.id);
                      }}
                    >
                      {account.name}
                    </button>
                  ))}
                {showCreateOption && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 font-medium"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur
                        setShowCreateAccount(true);
                      }}
                    >
                      + Create "{accountSearch}"
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Owner combo box */}
          <div className="relative">
            <input
              type="text"
              value={ownerSearch}
              onChange={(e) => {
                const value = e.target.value;
                setOwnerSearch(value);
                // Find matching user by display name
                const match = Array.from(userNames.entries()).find(
                  ([, displayName]) => displayName.toLowerCase() === value.toLowerCase()
                );
                setFilterOwner(match ? match[0] : 'all');
              }}
              onFocus={() => setOwnerFocused(true)}
              onBlur={() => {
                // Close dropdown when input loses focus
                // Use setTimeout to allow onClick to fire first
                setTimeout(() => {
                  setOwnerFocused(false);
                  const exactMatch = Array.from(userNames.entries()).find(
                    ([, displayName]) => displayName.toLowerCase() === ownerSearch.toLowerCase()
                  );
                  if (exactMatch) {
                    // Keep the search value if it matches
                    setOwnerSearch(exactMatch[1]);
                  } else if (filterOwner === 'all') {
                    // Clear search if no owner is selected
                    setOwnerSearch('');
                  }
                }, 200);
              }}
              placeholder="All Owners"
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 min-w-[200px]"
            />
            {ownerFocused && (ownerSearch === '' || Array.from(userNames.values()).some(displayName => 
              displayName.toLowerCase().includes(ownerSearch.toLowerCase()) &&
              displayName.toLowerCase() !== ownerSearch.toLowerCase()
            )) && (
              <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    setOwnerSearch('');
                    setFilterOwner('all');
                  }}
                >
                  All Owners
                </button>
                {Array.from(userNames.entries())
                  .filter(([, displayName]) =>
                    ownerSearch === '' || displayName.toLowerCase().includes(ownerSearch.toLowerCase())
                  )
                  .slice(0, 20)
                  .map(([userId, displayName]) => (
                    <button
                      key={userId}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur
                        setOwnerSearch(displayName);
                        setFilterOwner(userId);
                      }}
                    >
                      {displayName}
                    </button>
                  ))}
              </div>
            )}
          </div>
          <NestedDateFilter
            dateFilterType={dateFilterType}
            dateFilterValue={dateFilterValue}
            onTypeChange={(type) => {
              setDateFilterType(type);
              if (type !== 'custom') {
                setCustomStartDate('');
                setCustomEndDate('');
              }
              if (type === 'all') {
                setDateFilterValue('');
              }
            }}
            onValueChange={setDateFilterValue}
            getYearOptions={getYearOptions}
            getQuarterOptions={getQuarterOptions}
            getMonthOptions={getMonthOptions}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomStartDateChange={setCustomStartDate}
            onCustomEndDateChange={setCustomEndDate}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(dateFilterType !== 'all' || filterStage !== 'all' || filterAccount !== 'all' || filterOwner !== 'all' || opportunityFilter !== 'all' || searchTerm.trim() !== '') && (
              <button
                onClick={() => {
                  setOpportunityFilter('all');
                  setFilterStage('all');
                  setFilterAccount('all');
                  setAccountSearch('');
                  setFilterOwner('all');
                  setOwnerSearch('');
                  setDateFilterType('all');
                  setDateFilterValue('');
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setSearchTerm('');
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
      <CreateAccountModal
        open={showCreateAccount}
        accountName={accountSearch}
        onClose={() => setShowCreateAccount(false)}
        onCreated={handleAccountCreated}
      />
    </div>
  );
}

