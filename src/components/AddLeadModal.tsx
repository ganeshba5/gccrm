import { useState, type FormEvent } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import type { Lead } from '../types';
import { db } from '../lib/firebase';

export default function AddLeadModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (lead: Lead) => void }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const now = new Date();
    
    // Prepare the lead data
    const newLead = {
      name,
      company,
      email,
      status: 'New' as const,
      owner: 'Unassigned',
      created_at: now.toISOString().split('T')[0],
    };

    try {
      // Add to Firestore
      const docRef = await addDoc(collection(db, 'leads'), newLead);
      
      // Create the complete lead object with the Firestore ID
      const completeLead: Lead = {
        id: docRef.id,
        ...newLead,
      };
      
      onCreate(completeLead);
    } catch (err) {
      console.error('Failed to create lead:', err);
      // Fallback to optimistic update
      onCreate({
        id: String(Date.now()),
        ...newLead,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-md shadow-md w-full max-w-md p-4">
        <h3 className="text-lg font-medium mb-3">Add Lead</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded px-2 py-1" required />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Company</label>
            <input value={company} onChange={e => setCompany(e.target.value)} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded px-2 py-1" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1 rounded border">Cancel</button>
            <button type="submit" className="px-3 py-1 rounded bg-indigo-600 text-white">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}
