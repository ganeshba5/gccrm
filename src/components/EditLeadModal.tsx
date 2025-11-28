import { useState, useEffect, type FormEvent } from 'react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import type { Lead } from '../types';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function EditLeadModal({ 
  open, 
  onClose, 
  onUpdate, 
  lead 
}: { 
  open: boolean; 
  onClose: () => void; 
  onUpdate: () => void;
  lead: Lead | null;
}) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'New' | 'Contacted' | 'Qualified' | 'Converted'>('New');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Populate form when lead changes
  useEffect(() => {
    if (lead) {
      setName(lead.name || '');
      setCompany(lead.company || '');
      setEmail(lead.email || '');
      setPhone(lead.phone || '');
      setStatus(lead.status || 'New');
    }
  }, [lead]);

  if (!open || !lead) return null;

  const resetForm = () => {
    if (lead) {
      setName(lead.name || '');
      setCompany(lead.company || '');
      setEmail(lead.email || '');
      setPhone(lead.phone || '');
      setStatus(lead.status || 'New');
    }
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Check if user is authenticated
    if (!user) {
      setError('You must be logged in to update leads. Please log in and try again.');
      setLoading(false);
      return;
    }

    // Validate required fields
    if (!name.trim()) {
      setError('Name is required');
      setLoading(false);
      return;
    }

    // Validate email format if provided
    if (email && !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    // Prepare the update data
    const updateData: any = {
      name: name.trim(),
      status: status,
    };

    // Add optional fields only if they have values
    if (company.trim()) {
      updateData.company = company.trim();
    } else {
      updateData.company = null; // Remove if empty
    }
    if (email.trim()) {
      updateData.email = email.trim();
    } else {
      updateData.email = null; // Remove if empty
    }
    if (phone.trim()) {
      updateData.phone = phone.trim();
    } else {
      updateData.phone = null; // Remove if empty
    }

    try {
      console.log('Updating lead with data:', updateData);
      console.log('Lead ID:', lead.id);
      
      // Update in Firestore
      const leadRef = doc(db, 'leads', lead.id);
      await updateDoc(leadRef, updateData);
      
      resetForm();
      onUpdate();
      onClose();
    } catch (err: any) {
      console.error('Failed to update lead:', err);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to update lead. ';
      if (err?.code === 'permission-denied') {
        if (!user) {
          errorMessage = 'You must be logged in to update leads. Please log in and try again.';
        } else {
          errorMessage = 'You do not have permission to update leads. Please contact an administrator.';
        }
      } else if (err?.code === 'unauthenticated') {
        errorMessage = 'Please log in to update leads.';
      } else if (err?.message) {
        errorMessage += err.message;
      } else {
        errorMessage += 'Please try again.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Edit Lead</h3>
        
        {error && (
          <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-lg text-error-700 text-sm dark:bg-error-900/20 dark:border-error-800 dark:text-error-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10" 
              required 
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company</label>
            <input 
              value={company} 
              onChange={e => setCompany(e.target.value)} 
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10" 
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10" 
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
            <input 
              type="tel"
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10" 
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as typeof status)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
              disabled={loading}
            >
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Converted">Converted</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button 
              type="button" 
              onClick={handleClose} 
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

