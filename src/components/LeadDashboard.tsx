import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { auth } from '../lib/firebase';
import LeadTable from './LeadTable';
import LeadProfilePanel from './LeadProfilePanel';
import AddLeadModal from './AddLeadModal';
import EmailVerificationBanner from './EmailVerificationBanner';
import { useAuth } from '../context/AuthContext';
import type { Lead } from '../types';
import { db } from '../lib/firebase';

const sampleLeads: Lead[] = [
  { id: '1', name: 'Alice Johnson', company: 'Acme Co', email: 'alice@acme.com', phone: '555-1234', status: 'New', owner: 'Ganesh', createdAt: new Date('2025-11-01') },
  { id: '2', name: 'Bob Smith', company: 'Beta LLC', email: 'bob@beta.com', phone: '555-5678', status: 'Contacted', owner: 'Priya', createdAt: new Date('2025-10-28') },
];

export default function LeadDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { user, loading: authLoading } = useAuth();

  const fetchLeads = async () => {
    try {
      console.log('Fetching leads - User authenticated:', !!user);
      console.log('User UID:', user?.uid);
      console.log('Auth current user:', auth.currentUser?.uid);
      
      // Ensure we have an authenticated user
      if (!auth.currentUser) {
        throw new Error('No authenticated user found');
      }
      
      // Get ID token to ensure it's available (this helps Firestore attach the token)
      // Force refresh to get a fresh token
      const token = await auth.currentUser.getIdToken(true);
      console.log('ID token obtained (forced refresh), length:', token.length);
      console.log('Token claims:', JSON.parse(atob(token.split('.')[1])));
      
      const leadsRef = collection(db, 'leads');
      
      // Try query without orderBy first (in case index isn't ready)
      console.log('Testing query without orderBy...');
      let querySnapshot;
      try {
        // Simple query without orderBy
        querySnapshot = await getDocs(leadsRef);
        console.log('Query without orderBy successful, found', querySnapshot.size, 'leads');
        
        // If successful, sort in memory
        const leadsArray = querySnapshot.docs.map(doc => ({
          doc,
          data: doc.data()
        }));
        leadsArray.sort((a, b) => {
          const aTime = a.data.createdAt?.toMillis?.() || 0;
          const bTime = b.data.createdAt?.toMillis?.() || 0;
          return bTime - aTime; // Descending
        });
        querySnapshot = {
          ...querySnapshot,
          docs: leadsArray.map(item => item.doc)
        } as typeof querySnapshot;
      } catch (simpleError: any) {
        console.error('Simple query failed:', simpleError);
        console.error('Error code:', simpleError.code);
        console.error('Error message:', simpleError.message);
        
        // If simple query fails, try with orderBy (might need index)
        console.log('Trying query with orderBy...');
        const q = query(leadsRef, orderBy('createdAt', 'desc'));
        querySnapshot = await getDocs(q);
      }
      
      console.log('Query successful, found', querySnapshot.size, 'leads');
      
      // Check if query was successful
      if (!querySnapshot) {
        throw new Error('Query returned no results');
      }

      const leads = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          company: data.company,
          email: data.email,
          phone: data.phone,
          status: data.status,
          owner: data.owner,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        } as Lead;
      });

      setLeads(leads);
    } catch (err: any) {
      console.error('Fetch leads failed', err);
      // Only fall back to sample data if it's a permission error
      if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') {
        console.warn('Permission denied - using sample data');
        setLeads(sampleLeads);
      } else {
        // For other errors, keep existing leads or show error
        console.error('Error fetching leads:', err.message || err);
      }
    }
  };

  const refreshLeads = async () => {
    // Refetch all leads from Firestore to ensure we have the latest data
    await fetchLeads();
  };

  useEffect(() => {
    // Wait for auth to be ready before fetching leads
    if (authLoading) {
      console.log('Waiting for auth to load...');
      return;
    }
    
    if (!user) {
      console.warn('No user authenticated, cannot fetch leads');
      return;
    }
    
    let mounted = true;
    
    const loadLeads = async () => {
      // Small delay to ensure auth token is properly attached to Firestore requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!mounted) return;
      await fetchLeads();
    };

    loadLeads();

    return () => { mounted = false; };
  }, [user, authLoading]);

  return (
    <div className="p-6 space-y-6">
      <EmailVerificationBanner />
      
      {/* Page Title */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <span className="text-4xl">👥</span>
          <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddOpen(true)}
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-lg shadow-theme-sm transition-colors font-medium text-sm"
          >
            + New Lead
          </button>
        </div>
      </div>

      {/* Filters and View Options */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <select className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700">
            <option>All Status</option>
            <option>New</option>
            <option>Contacted</option>
            <option>Qualified</option>
            <option>Converted</option>
          </select>
          <select className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700">
            <option>All Owners</option>
          </select>
          <select className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700">
            <option>All statuses</option>
            <option>New</option>
            <option>Contacted</option>
            <option>Qualified</option>
            <option>Converted</option>
          </select>
          <input
            type="text"
            placeholder="Owner"
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">Filters are client-side placeholders</p>
          <div className="flex items-center space-x-2">
            <input type="checkbox" className="w-4 h-4 text-brand-500 border-gray-300 rounded focus:ring-brand-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">{leads.length} results</span>
          </div>
        </div>
      </div>

        {/* Main Content Table */}
        <div>
          <LeadTable leads={leads} onSelectLead={setSelectedLead} />
        </div>

      <LeadProfilePanel lead={selectedLead} onClose={() => setSelectedLead(null)} />
      <AddLeadModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreate={async () => { 
          // Small delay to ensure Firestore has processed the write
          setTimeout(async () => {
            await refreshLeads(); 
          }, 500);
          setIsAddOpen(false); 
        }}
      />
    </div>
  );
}
