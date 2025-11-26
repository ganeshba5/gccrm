import { useState, type FormEvent } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import type { Lead } from '../types';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function AddLeadModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (lead: Lead) => void }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  if (!open) return null;

  const resetForm = () => {
    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
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
      setError('You must be logged in to create leads. Please log in and try again.');
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

    const now = Timestamp.now();
    
    // Prepare the lead data - only include fields that have values
    const newLead: any = {
      name: name.trim(),
      status: 'New' as const,
      owner: user?.uid || 'Unassigned',
      createdAt: now,
    };

    // Add optional fields only if they have values
    if (company.trim()) {
      newLead.company = company.trim();
    }
    if (email.trim()) {
      newLead.email = email.trim();
    }
    if (phone.trim()) {
      newLead.phone = phone.trim();
    }

    try {
      // Log the data being sent for debugging
      console.log('Creating lead with data:', {
        ...newLead,
        createdAt: newLead.createdAt.toString(),
        fieldCount: Object.keys(newLead).length
      });
      console.log('User UID:', user.uid);
      
      // Add to Firestore
      const docRef = await addDoc(collection(db, 'leads'), newLead);
      
      // Create the complete lead object with the Firestore ID
      const completeLead: Lead = {
        id: docRef.id,
        name: newLead.name,
        company: newLead.company,
        email: newLead.email,
        phone: newLead.phone,
        status: 'New' as const,
        owner: newLead.owner,
        createdAt: now.toDate(),
      };
      
      resetForm();
      onCreate(completeLead);
      onClose();
    } catch (err: any) {
      console.error('Failed to create lead:', err);
      console.error('User authenticated:', !!user);
      console.error('User UID:', user?.uid);
      console.error('Lead data:', newLead);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to create lead. ';
      if (err?.code === 'permission-denied') {
        if (!user) {
          errorMessage = 'You must be logged in to create leads. Please log in and try again.';
        } else {
          errorMessage = 'You do not have permission to create leads. Please contact an administrator.';
        }
      } else if (err?.code === 'unauthenticated') {
        errorMessage = 'Please log in to create leads.';
      } else if (err?.code === 'failed-precondition') {
        errorMessage = 'Validation failed. Please check that all fields are valid.';
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
      <div className="bg-white rounded-md shadow-md w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-medium mb-3">Add Lead</h3>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Name *</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
              required 
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Company</label>
            <input 
              value={company} 
              onChange={e => setCompany(e.target.value)} 
              className="w-full border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Phone</label>
            <input 
              type="tel"
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
              className="w-full border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
              disabled={loading}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button 
              type="button" 
              onClick={handleClose} 
              className="px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
