import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Opportunity } from '../types/opportunity';
import { opportunityService } from '../services/opportunityService';
import { accountService } from '../services/accountService';
import type { Account } from '../types/account';

const COLORS = ['#465fff', '#12b76a', '#f79009', '#f04438', '#7a5af8', '#ee46bc'];

export default function Dashboard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

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

  // Calculate opportunities by stage
  const opportunitiesByStage = opportunities.reduce((acc, opp) => {
    const stage = opp.stage || 'Unknown';
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(opportunitiesByStage).map(([name, value]) => ({
    name,
    value,
  }));

  // Calculate statistics
  const totalOpportunities = opportunities.length;
  const totalAccounts = accounts.length;
  // const newOpps = opportunitiesByStage['New'] || 0; // Reserved for future use
  // const qualifiedOpps = opportunitiesByStage['Qualified'] || 0; // Reserved for future use
  const closedWon = opportunitiesByStage['Closed Won'] || 0;
  const totalValue = opportunities.reduce((sum, opp) => sum + (opp.amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Page Title */}
      <div className="flex items-center space-x-3 mb-6">
        <span className="text-4xl">📊</span>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
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
          ) : opportunities.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {opportunities
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
