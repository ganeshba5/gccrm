import { useState, useEffect, type FormEvent } from 'react';
import type { Opportunity } from '../types/opportunity';
import { opportunityService } from '../services/opportunityService';
import { accountService } from '../services/accountService';
import { useAuth } from '../context/AuthContext';

export default function EditOpportunityModal({ 
  open, 
  onClose, 
  onUpdate, 
  opportunity 
}: { 
  open: boolean; 
  onClose: () => void; 
  onUpdate: () => void;
  opportunity: Opportunity | null;
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
  const [accountName, setAccountName] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (opportunity) {
      setName(opportunity.name || '');
      setAccountId(opportunity.accountId || '');
      setAmount(opportunity.amount?.toString() || '');
      setStage(opportunity.stage || 'New');
      setProbability(opportunity.probability?.toString() || '');
      setExpectedCloseDate(opportunity.expectedCloseDate ? opportunity.expectedCloseDate.toISOString().split('T')[0] : '');
      setDescription(opportunity.description || '');
      
      // Fetch account name if accountId exists
      if (opportunity.accountId) {
        accountService.getById(opportunity.accountId)
          .then(account => {
            if (account) {
              setAccountName(account.name);
            } else {
              setAccountName(null);
            }
          })
          .catch(err => {
            console.error('Error fetching account:', err);
            setAccountName(null);
          });
      } else {
        setAccountName(null);
      }
    }
  }, [opportunity]);

  if (!open || !opportunity) return null;

  const resetForm = () => {
    if (opportunity) {
      setName(opportunity.name || '');
      setAccountId(opportunity.accountId || '');
      setAmount(opportunity.amount?.toString() || '');
      setStage(opportunity.stage || 'New');
      setProbability(opportunity.probability?.toString() || '');
      setExpectedCloseDate(opportunity.expectedCloseDate ? opportunity.expectedCloseDate.toISOString().split('T')[0] : '');
      setDescription(opportunity.description || '');
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

    if (!user) {
      setError('You must be logged in to update opportunities. Please log in and try again.');
      setLoading(false);
      return;
    }

    if (!name.trim()) {
      setError('Opportunity name is required');
      setLoading(false);
      return;
    }

    try {
      const updateData: any = {
        name: name.trim(),
        stage,
      };

      if (accountId.trim()) {
        updateData.accountId = accountId.trim();
      } else {
        updateData.accountId = null;
      }
      if (amount) {
        updateData.amount = parseFloat(amount);
      } else {
        updateData.amount = null;
      }
      if (probability) {
        updateData.probability = parseInt(probability);
      } else {
        updateData.probability = null;
      }
      if (expectedCloseDate) {
        updateData.expectedCloseDate = new Date(expectedCloseDate);
      } else {
        updateData.expectedCloseDate = null;
      }
      if (description.trim()) {
        updateData.description = description.trim();
      } else {
        updateData.description = null;
      }

      await opportunityService.update(opportunity.id, updateData);
      
      resetForm();
      onUpdate();
      onClose();
    } catch (err: any) {
      console.error('Failed to update opportunity:', err);
      
      let errorMessage = 'Failed to update opportunity. ';
      if (err?.code === 'permission-denied') {
        errorMessage = 'You do not have permission to update opportunities. Please contact an administrator.';
      } else if (err?.code === 'unauthenticated') {
        errorMessage = 'Please log in to update opportunities.';
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
        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Edit Opportunity</h3>
        
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account</label>
            <input 
              value={accountName || accountId || ''} 
              readOnly
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed" 
              disabled={true}
              placeholder={accountId ? 'Loading account name...' : 'No account'}
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
              {loading ? 'Updating...' : 'Update Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

