import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Opportunity } from '../types/opportunity';
import { opportunityService } from '../services/opportunityService';
import { accountService } from '../services/accountService';
import type { Account } from '../types/account';
import NestedDateFilter from './NestedDateFilter';

const COLORS = ['#465fff', '#12b76a', '#f79009', '#f04438', '#7a5af8', '#ee46bc'];

export default function Dashboard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // Date filter state with localStorage persistence
  const [dateFilterType, setDateFilterType] = useState<string>(() => {
    const saved = localStorage.getItem('dashboard_dateFilterType');
    return saved || 'all';
  });
  const [dateFilterValue, setDateFilterValue] = useState<string>(() => {
    const saved = localStorage.getItem('dashboard_dateFilterValue');
    return saved || '';
  });
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const saved = localStorage.getItem('dashboard_customStartDate');
    return saved || '';
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const saved = localStorage.getItem('dashboard_customEndDate');
    return saved || '';
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Save filter settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('dashboard_dateFilterType', dateFilterType);
  }, [dateFilterType]);

  useEffect(() => {
    localStorage.setItem('dashboard_dateFilterValue', dateFilterValue);
  }, [dateFilterValue]);

  useEffect(() => {
    localStorage.setItem('dashboard_customStartDate', customStartDate);
  }, [customStartDate]);

  useEffect(() => {
    localStorage.setItem('dashboard_customEndDate', customEndDate);
  }, [customEndDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [oppsData, accountsData] = await Promise.all([
        opportunityService.getAll(),
        accountService.getAll()
      ]);
      setOpportunities(oppsData);
      setAccounts(accountsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
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

  // Filter opportunities based on date filter
  const filteredOpportunities = opportunities.filter(opp => {
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

  // Calculate opportunities by stage (using filtered opportunities)
  const opportunitiesByStage = filteredOpportunities.reduce((acc, opp) => {
    const stage = opp.stage || 'Unknown';
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(opportunitiesByStage).map(([name, value]) => ({
    name,
    value,
  }));

  // Calculate statistics (using filtered opportunities)
  const totalOpportunities = filteredOpportunities.length;
  const totalAccounts = accounts.length;
  // const newOpps = opportunitiesByStage['New'] || 0; // Reserved for future use
  // const qualifiedOpps = opportunitiesByStage['Qualified'] || 0; // Reserved for future use
  const closedWon = opportunitiesByStage['Closed Won'] || 0;
  const totalValue = filteredOpportunities.reduce((sum, opp) => sum + (opp.amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Date Filter */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
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
          {dateFilterType !== 'all' && (
            <button
              onClick={() => {
                setDateFilterType('all');
                setDateFilterValue('');
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Clear Filter
            </button>
          )}
        </div>
        {dateFilterType !== 'all' && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredOpportunities.length} of {opportunities.length} opportunities
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Opportunities</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{totalOpportunities}</p>
            </div>
            <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl">💼</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Accounts</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{totalAccounts}</p>
            </div>
            <div className="w-12 h-12 bg-success-100 dark:bg-success-900/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🏢</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Value</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                ${(totalValue / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="w-12 h-12 bg-warning-100 dark:bg-warning-900/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Closed Won</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{closedWon}</p>
            </div>
            <div className="w-12 h-12 bg-success-100 dark:bg-success-900/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Grid - 4 Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Opportunities by Stage Donut Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Opportunities by Stage</h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  innerRadius={40}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              No opportunities data available
            </div>
          )}
        </div>

        {/* Section 2: Recent Opportunities List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Opportunities</h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            </div>
          ) : filteredOpportunities.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {filteredOpportunities
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                .slice(0, 5)
                .map((opp) => (
                  <div key={opp.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{opp.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {opp.amount ? `$${opp.amount.toLocaleString()}` : 'No amount'}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        opp.stage === 'New'
                          ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/20 dark:text-brand-400'
                          : opp.stage === 'Qualified'
                          ? 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-400'
                          : opp.stage === 'Closed Won'
                          ? 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-400'
                          : opp.stage === 'Closed Lost'
                          ? 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {opp.stage}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              No opportunities found
            </div>
          )}
        </div>

        {/* Section 3: Stage Distribution (Table) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Stage Distribution</h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(opportunitiesByStage).map(([stage, count]) => (
                <div key={stage} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{stage}</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{count}</span>
                </div>
              ))}
              {Object.keys(opportunitiesByStage).length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">No data available</div>
              )}
            </div>
          )}
        </div>

        {/* Section 4: Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/opportunities')}
              className="w-full px-4 py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-medium"
            >
              + Add New Opportunity
            </button>
            <button
              onClick={() => navigate('/accounts/new')}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              + Add New Account
            </button>
            <button
              onClick={() => navigate('/contacts/new')}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              + Add New Contact
            </button>
            <button
              onClick={() => navigate('/tasks/new')}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              + Add New Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
