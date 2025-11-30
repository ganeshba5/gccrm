import { useState, useEffect, type FormEvent } from 'react';
import { accountService } from '../services/accountService';
import { useAuth } from '../context/AuthContext';
import type { Account } from '../types/account';

interface CreateAccountModalProps {
  open: boolean;
  accountName: string; // Pre-filled account name
  onClose: () => void;
  onCreated: (account: Account) => void;
}

export default function CreateAccountModal({ 
  open, 
  accountName, 
  onClose, 
  onCreated 
}: CreateAccountModalProps) {
  const [name, setName] = useState(accountName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Update name when accountName prop changes
  useEffect(() => {
    if (open && accountName) {
      setName(accountName);
    }
  }, [open, accountName]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!user) {
      setError('You must be logged in to create accounts.');
      setLoading(false);
      return;
    }

    if (!name.trim()) {
      setError('Account name is required');
      setLoading(false);
      return;
    }

    try {
      const accountData = {
        name: name.trim(),
        status: 'prospect' as const,
      };
      
      const accountId = await accountService.create(accountData, user.id);
      // Fetch the created account to get the full Account object
      const newAccount = await accountService.getById(accountId);
      if (!newAccount) {
        throw new Error('Failed to retrieve created account');
      }
      setName('');
      onCreated(newAccount);
      onClose();
    } catch (err: any) {
      console.error('Failed to create account:', err);
      
      let errorMessage = 'Failed to create account. ';
      if (err?.code === 'permission-denied') {
        errorMessage = 'You do not have permission to create accounts. Please contact an administrator.';
      } else if (err?.code === 'unauthenticated') {
        errorMessage = 'Please log in to create accounts.';
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

  const handleClose = () => {
    setName('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-lg w-full max-w-md mx-4 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Create New Account</h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
            title="Cancel"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 6L14 14M6 14L14 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        
        {error && (
          <div className="mb-3 p-2.5 bg-error-50 border border-error-200 rounded-lg text-error-700 text-xs dark:bg-error-900/20 dark:border-error-800 dark:text-error-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Account Name *
            </label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10" 
              required 
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

