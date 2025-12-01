import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import type { AccountFormData } from '../types/account';
import type { Note } from '../types/note';
import type { User } from '../types/user';
import { accountService } from '../services/accountService';
import { opportunityService } from '../services/opportunityService';
import { noteService } from '../services/noteService';
import { userService } from '../services/userService';
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
  const [notes, setNotes] = useState<Note[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [notesLoading, setNotesLoading] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) {
      loadAccount(id);
    }
  }, [id]);

  useEffect(() => {
    // Load users for displaying note creators
    const loadUsers = async () => {
      try {
        const usersData = await userService.getAll();
        const usersMap = new Map<string, User>();
        usersData.forEach(u => usersMap.set(u.id, u));
        setUsers(usersMap);
      } catch (err) {
        console.error('Error loading users:', err);
      }
    };
    loadUsers();
  }, []);

  useEffect(() => {
    // Load notes when account ID is available
    if (id && user) {
      loadNotes(id);
    }
  }, [id, user]);

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

  const loadNotes = async (accountId: string) => {
    if (!user) return;
    
    try {
      setNotesLoading(true);
      const allNotes = await noteService.getByAccount(accountId);
      
      // Filter: show public notes (isPrivate === false or undefined) or notes created by current user
      const filteredNotes = allNotes.filter(note => 
        !note.isPrivate || note.createdBy === user.id
      );
      
      setNotes(filteredNotes);
    } catch (err) {
      console.error('Error loading notes:', err);
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  const getUserName = (userId: string): string => {
    const userData = users.get(userId);
    if (userData) {
      return userData.displayName || 
             (userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : '') ||
             userData.email;
    }
    return userId;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleNoteExpansion = (noteId: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  const truncateContent = (content: string, maxLength: number = 80): string => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (loading && id) {
    return <div className="p-4">Loading account data...</div>;
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white text-left">
            {isViewMode ? 'View Account' : id ? 'Edit Account' : 'New Account'}
          </h2>
          <div className="flex items-center gap-2">
            <label htmlFor="status" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Status:
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              disabled={isReadOnly}
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed min-w-[120px]"
            >
              <option value="prospect">Prospect</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

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
          {/* Account Name: Label and Field in 1 line */}
          <div className="flex items-center gap-2">
            <label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
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
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            />
          </div>

          {/* Email, Phone: Label and Field in 1 line */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Email:
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email || ''}
                onChange={handleInputChange}
                disabled={isReadOnly}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="phone" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Phone:
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone || ''}
                onChange={handleInputChange}
                disabled={isReadOnly}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Website, Industry: Labels and fields spread out */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="website" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Website:
              </label>
              <input
                type="url"
                id="website"
                name="website"
                value={formData.website || ''}
                onChange={handleInputChange}
                disabled={isReadOnly}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="industry" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Industry:
              </label>
              <input
                type="text"
                id="industry"
                name="industry"
                value={formData.industry || ''}
                onChange={handleInputChange}
                disabled={isReadOnly}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Description: Label left aligned */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 text-left mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description || ''}
              onChange={handleInputChange}
              rows={4}
              disabled={isReadOnly}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
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

        {/* Notes Section - only show when editing existing account */}
        {id && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-md font-medium mb-3 text-gray-900 dark:text-white text-left">Notes</h4>
            
            {notesLoading ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                Loading notes...
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-3 text-gray-500 dark:text-gray-400 text-sm">
                No notes found
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto">
                {/* Grid Header */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky top-0">
                  <div className="col-span-3">Created By</div>
                  <div className="col-span-5">Content</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1"></div>
                </div>
                {/* Grid Rows */}
                <div className="divide-y divide-gray-200 dark:divide-gray-600">
                  {notes.map((note) => {
                    const isExpanded = expandedNotes.has(note.id);
                    const contentIsLong = note.content.length > 80;
                    const displayContent = isExpanded || !contentIsLong 
                      ? note.content 
                      : truncateContent(note.content, 80);
                    
                    return (
                      <div key={note.id} className="grid grid-cols-12 gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors items-center">
                        <div className="col-span-3">
                          <span className="text-xs text-gray-900 dark:text-white truncate block">
                            {getUserName(note.createdBy)}
                          </span>
                        </div>
                        <div className="col-span-5">
                          <div className="flex items-center gap-1">
                            <span className={`text-xs text-gray-700 dark:text-gray-300 ${!isExpanded && contentIsLong ? 'truncate' : ''} ${isExpanded ? 'line-clamp-2' : ''}`}>
                              {displayContent}
                            </span>
                            {contentIsLong && (
                              <button
                                onClick={() => toggleNoteExpansion(note.id)}
                                className="flex-shrink-0 text-xs text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 flex items-center"
                                title={isExpanded ? "Show less" : "Show more"}
                              >
                                {isExpanded ? (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {formatDate(note.createdAt)}
                          </span>
                        </div>
                        <div className="col-span-1">
                          {note.isPrivate && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 rounded whitespace-nowrap">
                              Private
                            </span>
                          )}
                        </div>
                        <div className="col-span-1"></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

