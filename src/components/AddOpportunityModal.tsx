import { useState, useEffect, type FormEvent } from 'react';
import type { Opportunity } from '../types/opportunity';
import type { Account } from '../types/account';
import { opportunityService } from '../services/opportunityService';
import { accountService } from '../services/accountService';
import { useAuth } from '../context/AuthContext';
import DatePicker from './DatePicker';
import CreateAccountModal from './CreateAccountModal';

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
  const [accountSearch, setAccountSearch] = useState('');
  const [accountFocused, setAccountFocused] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState<Opportunity['stage']>('New');
  const [probability, setProbability] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const accountsData = await accountService.getAll();
        setAccounts(accountsData);
      } catch (err) {
        console.error('Error loading accounts:', err);
      }
    };
    if (open) {
      loadAccounts();
    }
  }, [open]);

  if (!open) return null;

  const resetForm = () => {
    setName('');
    setAccountId('');
    setAccountSearch('');
    setAmount('');
    setStage('New');
    setProbability('');
    setExpectedCloseDate('');
    setDescription('');
    setError(null);
    setShowCreateAccount(false);
  };

  const handleAccountCreated = async (newAccount: Account) => {
    // Reload accounts list
    try {
      const accountsData = await accountService.getAll();
      setAccounts(accountsData);
      // Set the newly created account
      setAccountSearch(newAccount.name);
      setAccountId(newAccount.id);
      setShowCreateAccount(false);
    } catch (err) {
      console.error('Error reloading accounts:', err);
    }
  };

  // Check if account name doesn't exist
  const accountExists = accounts.some(
    (account) => account.name.toLowerCase() === accountSearch.toLowerCase()
  );
  const showCreateOption = accountSearch.trim() && !accountExists && accountSearch.length > 0;

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
    <div className="fixed inset-0 bg-black/40 flex justify-center items-start z-50 overflow-y-auto pt-24 px-4" onClick={handleClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-lg w-full max-w-2xl mb-8 px-4 sm:px-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">New Opportunity</h3>
          <div className="flex items-center gap-2">
            {/* Cancel icon */}
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
            {/* Save icon */}
            <button
              type="submit"
              form="add-opportunity-form"
              className="p-1.5 rounded-full text-brand-500 hover:text-white hover:bg-brand-500 dark:text-brand-400 dark:hover:bg-brand-500 transition-colors disabled:opacity-50"
              title="Create"
              disabled={loading}
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 10.5L8.5 14L15 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mb-3 p-2.5 bg-error-50 border border-error-200 rounded-lg text-error-700 text-xs dark:bg-error-900/20 dark:border-error-800 dark:text-error-400">
            {error}
          </div>
        )}

        <form id="add-opportunity-form" onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Name:
                </label>
                <input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10" 
                  required 
                  disabled={loading}
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Account:
                </label>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={accountSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setAccountSearch(value);
                      // If exact match, set accountId, otherwise clear it
                      const match = accounts.find(
                        (account) => account.name.toLowerCase() === value.toLowerCase()
                      );
                      setAccountId(match ? match.id : '');
                    }}
                    onFocus={() => setAccountFocused(true)}
                    onBlur={() => {
                      setTimeout(() => setAccountFocused(false), 200);
                    }}
                    placeholder="Search or select account"
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                    disabled={loading}
                  />
                  {accountFocused && (accountSearch === '' || accounts.some(account => 
                    account.name.toLowerCase().includes(accountSearch.toLowerCase())
                  ) || showCreateOption) && (
                    <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => {
                          setAccountSearch('');
                          setAccountId('');
                        }}
                      >
                        No Account
                      </button>
                      {accounts
                        .filter((account) =>
                          accountSearch === '' || account.name.toLowerCase().includes(accountSearch.toLowerCase())
                        )
                        .slice(0, 20)
                        .map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                            onClick={() => {
                              setAccountSearch(account.name);
                              setAccountId(account.id);
                            }}
                          >
                            {account.name}
                          </button>
                        ))}
                      {showCreateOption && (
                        <div className="border-t border-gray-200 dark:border-gray-700">
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 font-medium"
                            onClick={() => setShowCreateAccount(true)}
                          >
                            + Create "{accountSearch}"
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-2 sm:flex-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Amount:
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10" 
                    disabled={loading}
                  />
                </div>
                <div className="flex items-center gap-2 sm:flex-1 mt-2 sm:mt-0">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Stage:
                  </label>
                  <select
                    value={stage}
                    onChange={e => setStage(e.target.value as Opportunity['stage'])}
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
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
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Probability (%):
                </label>
                <input 
                  type="number"
                  min="0"
                  max="100"
                  value={probability} 
                  onChange={e => setProbability(e.target.value)} 
                  className="w-20 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10" 
                  disabled={loading}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Close Date:
                </label>
                <DatePicker
                  value={expectedCloseDate}
                  onChange={setExpectedCloseDate}
                  placeholder="Select close date"
                  disabled={loading}
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">Description:</label>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10" 
                rows={2}
                disabled={loading}
              />
            </div>
          </div>
        </form>
      </div>
      <CreateAccountModal
        open={showCreateAccount}
        accountName={accountSearch}
        onClose={() => setShowCreateAccount(false)}
        onCreated={handleAccountCreated}
      />
    </div>
  );
}

