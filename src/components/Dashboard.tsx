import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Lead } from '../types';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const leadsRef = collection(db, 'leads');
      const querySnapshot = await getDocs(leadsRef);
      const leadsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Lead[];
      setLeads(leadsData);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate leads by status
  const leadsByStatus = leads.reduce((acc, lead) => {
    const status = lead.status || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(leadsByStatus).map(([name, value]) => ({
    name,
    value,
  }));

  // Calculate statistics
  const totalLeads = leads.length;
  const newLeads = leadsByStatus['New'] || 0;
  const contactedLeads = leadsByStatus['Contacted'] || 0;
  const qualifiedLeads = leadsByStatus['Qualified'] || 0;
  const convertedLeads = leadsByStatus['Converted'] || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Page Title */}
      <div className="flex items-center space-x-3 mb-6">
        <span className="text-4xl">📊</span>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Leads</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{totalLeads}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">New</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{newLeads}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🆕</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Contacted</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{contactedLeads}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📞</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Qualified</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{qualifiedLeads}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">⭐</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Grid - 4 Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Leads by Status Donut Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Leads by Status</h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  innerRadius={40}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No leads data available
            </div>
          )}
        </div>

        {/* Section 2: Recent Leads List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Leads</h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : leads.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {leads
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                .slice(0, 5)
                .map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{lead.name}</p>
                      <p className="text-sm text-gray-500">{lead.company || 'No company'}</p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        lead.status === 'New'
                          ? 'bg-blue-100 text-blue-800'
                          : lead.status === 'Contacted'
                          ? 'bg-yellow-100 text-yellow-800'
                          : lead.status === 'Qualified'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {lead.status}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No leads found
            </div>
          )}
        </div>

        {/* Section 3: Status Distribution (Table) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution</h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(leadsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700">{status}</span>
                  <span className="text-lg font-bold text-gray-900">{count}</span>
                </div>
              ))}
              {Object.keys(leadsByStatus).length === 0 && (
                <div className="text-center text-gray-500 py-8">No data available</div>
              )}
            </div>
          )}
        </div>

        {/* Section 4: Quick Actions / Activity Feed */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/leads')}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              + Add New Lead
            </button>
            <button
              onClick={() => navigate('/leads')}
              className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              View All Leads
            </button>
            <button className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">
              Export Data
            </button>
            <button className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

