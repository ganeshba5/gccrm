import { useState, type FormEvent } from 'react';
import type { Opportunity } from '../types/opportunity';
import { opportunityService } from '../services/opportunityService';
import { useAuth } from '../context/AuthContext';

export default function AddOpportunityModal({ 
  open, 
  onClose, 
  onCreate 
}: { 
  open: boolean; 
  onClose: () => void; 
  onCreate: () => void;
}) {
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState<Opportunity['stage']>('New');
  const [probability, setProbability] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  if (!open) return null;

  const resetForm = () => {
    setName('');
    setAccountId('');
    setAmount('');
    setStage('New');
    setProbability('');
    setExpectedCloseDate('');
    setDescription('');
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

    if (!user) {
      setError('You must be logged in to create opportunities. Please log in and try again.');
      setLoading(false);
      return;
    }

    if (!name.trim()) {
      setError('Opportunity name is required');
      setLoading(false);
      return;
    }

    try {
      const opportunityData = {
        name: name.trim(),
        accountId: accountId.trim() || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        stage,
        probability: probability ? parseInt(probability) : undefined,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
        description: description.trim() || undefined,
        owner: user.id,
      };

      if (!user) {
        setError('You must be logged in');
        setLoading(false);
        return;
      }
      await opportunityService.create(opportunityData, user.id);
      
      resetForm();
      onCreate();
      onClose();
    } catch (err: any) {
      console.error('Failed to create opportunity:', err);
      
      let errorMessage = 'Failed to create opportunity. ';
      if (err?.code === 'permission-denied') {
        errorMessage = 'You do not have permission to create opportunities. Please contact an administrator.';
      } else if (err?.code === 'unauthenticated') {
        errorMessage = 'Please log in to create opportunities.';
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
        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Add Opportunity</h3>
        
        {error && (
          <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-lg text-error-700 text-sm dark:bg-error-900/20 dark:border-error-800 dark:text-error-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Opportunity Name *</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10" 
              required 
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account ID</label>
            <input 
              value={accountId} 
              onChange={e => setAccountId(e.target.value)} 
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10" 
              placeholder="Optional: Link to account"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
            <input 
              type="number"
              step="0.01"
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10" 
              placeholder="0.00"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stage *</label>
            <select
              value={stage}
              onChange={e => setStage(e.target.value as Opportunity['stage'])}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
              required
              disabled={loading}
            >
              <option value="New">New</option>
              <option value="Qualified">Qualified</option>
              <option value="Proposal">Proposal</option>
              <option value="Negotiation">Negotiation</option>
              <option value="Closed Won">Closed Won</option>
              <option value="Closed Lost">Closed Lost</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Probability (%)</label>
            <input 
              type="number"
              min="0"
              max="100"
              value={probability} 
              onChange={e => setProbability(e.target.value)} 
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10" 
              placeholder="0-100"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Close Date</label>
            <input 
              type="date"
              value={expectedCloseDate} 
              onChange={e => setExpectedCloseDate(e.target.value)} 
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10" 
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10" 
              rows={3}
              disabled={loading}
            />
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
              {loading ? 'Creating...' : 'Create Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

