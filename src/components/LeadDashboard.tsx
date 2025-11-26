import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import LeadTable from './LeadTable';
import LeadProfilePanel from './LeadProfilePanel';
import LeadFilters from './LeadFilters';
import AddLeadModal from './AddLeadModal';
import type { Lead } from '../types';
import { db } from '../lib/firebase';

const sampleLeads: Lead[] = [
  { id: '1', name: 'Alice Johnson', company: 'Acme Co', email: 'alice@acme.com', phone: '555-1234', status: 'New', owner: 'Ganesh', created_at: '2025-11-01' },
  { id: '2', name: 'Bob Smith', company: 'Beta LLC', email: 'bob@beta.com', phone: '555-5678', status: 'Contacted', owner: 'Priya', created_at: '2025-10-28' },
];

export default function LeadDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const refreshLeads = (newLead?: Lead) => {
    if (newLead) setLeads(prev => [newLead, ...prev]);
  };

  useEffect(() => {
    let mounted = true;
    const fetchLeads = async () => {
      try {
        const leadsRef = collection(db, 'leads');
        const q = query(leadsRef, orderBy('created_at', 'desc'));
        const querySnapshot = await getDocs(q);
        
        if (!mounted) return;

        const leads = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Lead[];

        setLeads(leads);
      } catch (err) {
        console.error('Fetch leads failed', err);
        setLeads(sampleLeads);
      }
    };

    fetchLeads();

    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Leads</h1>
            <p className="text-sm text-gray-500">Manage and convert your leads</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAddOpen(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-indigo-700"
            >
              + New Lead
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <LeadFilters />
              <LeadTable leads={leads} onSelectLead={setSelectedLead} />
            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Overview</h3>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">Total leads: {leads.length}</div>
                <div className="text-sm text-gray-600">New: {leads.filter(l => l.status === 'New').length}</div>
                <div className="text-sm text-gray-600">Contacted: {leads.filter(l => l.status === 'Contacted').length}</div>
              </div>
            </div>
          </aside>
        </div>

        <LeadProfilePanel lead={selectedLead} onClose={() => setSelectedLead(null)} />
        <AddLeadModal
          open={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onCreate={(lead: Lead) => { refreshLeads(lead); setIsAddOpen(false); }}
        />
      </div>
    </div>
  );
}
