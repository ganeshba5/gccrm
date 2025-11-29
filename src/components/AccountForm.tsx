import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import type { AccountFormData } from '../types/account';
import { accountService } from '../services/accountService';
import { opportunityService } from '../services/opportunityService';
import { useAuth } from '../context/AuthContext';
import { canAccessAllData } from '../lib/auth-helpers';

const initialFormData: AccountFormData = {
  name: '',
  website: '',
  industry: '',
  phone: '',
  email: '',
  billingAddress: undefined,
  shippingAddress: undefined,
  status: 'prospect',
  description: '',
  assignedTo: undefined
};

export function AccountForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isViewMode = location.pathname.includes('/view');
  const { user } = useAuth();
  const [formData, setFormData] = useState<AccountFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(isViewMode);
  const [readOnlyReason, setReadOnlyReason] = useState<string | null>(isViewMode ? 'View only mode' : null);
  const [, setAccount] = useState<any>(null);

  useEffect(() => {
    if (id) {
      loadAccount(id);
    }
  }, [id]);

  const loadAccount = async (accountId: string) => {
    try {
      setLoading(true);
      const accountData = await accountService.getById(accountId);
      if (accountData) {
        setAccount(accountData);
        setFormData({
          name: accountData.name,
          website: accountData.website || '',
          industry: accountData.industry || '',
          phone: accountData.phone || '',
          email: accountData.email || '',
          billingAddress: accountData.billingAddress,
          shippingAddress: accountData.shippingAddress,
          status: accountData.status,
          description: accountData.description || '',
          assignedTo: accountData.assignedTo
        });

        // Check if user can edit this account (only if not in view mode)
        if (user && !isViewMode) {
          const isAdmin = await canAccessAllData();
          
          if (!isAdmin) {
            // Check if account is owned by user
            if (accountData.createdBy !== user.id) {
              setIsReadOnly(true);
              setReadOnlyReason('You can only edit accounts you created.');
            } else {
              // For non-admin users, accounts linked to opportunities are read-only
              // (even if they own the account)
              try {
                const opportunities = await opportunityService.getByAccount(accountId);
                if (opportunities.length > 0) {
                  setIsReadOnly(true);
                  setReadOnlyReason('This account is linked to opportunities and is read-only.');
                }
              } catch (err) {
                console.error('Error checking opportunities:', err);
              }
            }
          }
        }
      }
    } catch (err) {
      setError('Failed to load account');
      console.error('Error loading account:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isReadOnly) {
      setError(readOnlyReason || 'This account cannot be edited.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        website: formData.website || undefined,
        industry: formData.industry || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        description: formData.description || undefined,
      };

      if (!user) {
        setError('You must be logged in');
        setLoading(false);
        return;
      }

      if (id) {
        await accountService.update(id, submitData);
      } else {
        await accountService.create(submitData, user.id);
      }
      navigate('/accounts');
    } catch (err) {
      setError('Failed to save account');
      console.error('Error saving account:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading && id) {
    return <div className="p-4">Loading account data...</div>;
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">
          {isViewMode ? 'View Account' : id ? 'Edit Account' : 'New Account'}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-lg text-error-700 text-sm dark:bg-error-900/20 dark:border-error-800 dark:text-error-400">
            {error}
          </div>
        )}

        {isReadOnly && readOnlyReason && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400">
            {readOnlyReason}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Account Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              disabled={isReadOnly}
              className="mt-1 block w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email || ''}
                onChange={handleInputChange}
                disabled={isReadOnly}
                className="mt-1 block w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone || ''}
                onChange={handleInputChange}
                disabled={isReadOnly}
                className="mt-1 block w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="website" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Website
              </label>
              <input
                type="url"
                id="website"
                name="website"
                value={formData.website || ''}
                onChange={handleInputChange}
                disabled={isReadOnly}
                className="mt-1 block w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="industry" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Industry
              </label>
              <input
                type="text"
                id="industry"
                name="industry"
                value={formData.industry || ''}
                onChange={handleInputChange}
                disabled={isReadOnly}
                className="mt-1 block w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              disabled={isReadOnly}
              className="mt-1 block w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              <option value="prospect">Prospect</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description || ''}
              onChange={handleInputChange}
              rows={4}
              disabled={isReadOnly}
              className="mt-1 block w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/accounts')}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isReadOnly}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : isReadOnly ? 'Read Only' : 'Save Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

