import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Contact } from '../types/contact';
import { contactService } from '../services/contactService';
import { accountService } from '../services/accountService';
import { noteService } from '../services/noteService';
import type { Account } from '../types/account';

export function ContactList() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [contactNotes, setContactNotes] = useState<Map<string, string>>(new Map());
  const [notesLoading, setNotesLoading] = useState(false);

  useEffect(() => {
    loadAccounts();
    loadContacts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadContactsByAccount(selectedAccountId);
    } else {
      loadContacts();
    }
  }, [selectedAccountId]);

  // Load notes for contacts when search term is present
  useEffect(() => {
    if (searchTerm.trim() && contacts.length > 0) {
      const loadNotesForContacts = async () => {
        setNotesLoading(true);
        const notesMap = new Map<string, string>();
        try {
          await Promise.all(
            contacts.map(async (contact) => {
              try {
                const notes = await noteService.getByContact(contact.id);
                const notesContent = notes.map(n => n.content.replace(/<[^>]*>/g, '')).join(' ');
                if (notesContent) {
                  notesMap.set(contact.id, notesContent);
                }
              } catch (err) {
                console.error(`Error loading notes for contact ${contact.id}:`, err);
              }
            })
          );
          setContactNotes(notesMap);
        } catch (err) {
          console.error('Error loading notes:', err);
        } finally {
          setNotesLoading(false);
        }
      };
      loadNotesForContacts();
    } else {
      setContactNotes(new Map());
    }
  }, [searchTerm, contacts]);

  const loadAccounts = async () => {
    try {
      const data = await accountService.getAll();
      setAccounts(data);
    } catch (err) {
      console.error('Error loading accounts:', err);
    }
  };

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await contactService.getAll();
      setContacts(data);
      setError(null);
    } catch (err) {
      setError('Failed to load contacts');
      console.error('Error loading contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadContactsByAccount = async (accountId: string) => {
    try {
      setLoading(true);
      const data = await contactService.getByAccount(accountId);
      setContacts(data);
      setError(null);
    } catch (err) {
      setError('Failed to load contacts');
      console.error('Error loading contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name || accountId;
  };

  // Filter contacts based on search term
  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) {
      return contacts;
    }

    const searchLower = searchTerm.toLowerCase();
    return contacts.filter((contact) => {
      // Search in contact name
      const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
      if (fullName.includes(searchLower)) return true;

      // Search in title
      if (contact.title?.toLowerCase().includes(searchLower)) return true;

      // Search in email
      if (contact.email?.toLowerCase().includes(searchLower)) return true;

      // Search in account name
      const accountName = getAccountName(contact.accountId).toLowerCase();
      if (accountName.includes(searchLower)) return true;

      // Search in contact's notes field
      if (contact.notes?.toLowerCase().includes(searchLower)) return true;

      // Search in related notes content
      const notesContent = contactNotes.get(contact.id);
      if (notesContent?.toLowerCase().includes(searchLower)) return true;

      return false;
    });
  }, [contacts, searchTerm, contactNotes, accounts]);

  if (loading) {
    return <div className="p-4">Loading contacts...</div>;
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-6">
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, title, email, account, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
          />
          {notesLoading && searchTerm.trim() && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Loading notes...</div>
          )}
        </div>
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
        >
          <option value="">All Accounts</option>
          {accounts.map(account => (
            <option key={account.id} value={account.id}>{account.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-4 text-error-600 dark:text-error-400">
          {error}
          <button 
            onClick={loadContacts}
            className="ml-4 text-brand-500 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Mobile/Tablet Card View */}
      <div className="lg:hidden space-y-4">
        {filteredContacts.map((contact) => (
          <div key={contact.id} className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => navigate(`/contacts/${contact.id}/edit`)}
                  className="text-sm font-medium text-brand-500 hover:text-brand-600 hover:underline break-words"
                >
                  {contact.firstName} {contact.lastName}
                </button>
                {contact.title && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{contact.title}</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Account:</span>
                <div className="text-gray-900 dark:text-white break-words">{getAccountName(contact.accountId)}</div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Email:</span>
                <div className="text-gray-900 dark:text-white break-words">{contact.email || '-'}</div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Phone:</span>
                <div className="text-gray-900 dark:text-white">{contact.phone || contact.mobile || '-'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                className="p-1.5 text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500/10 rounded transition-colors"
                onClick={() => navigate(`/contacts/${contact.id}/notes`)}
                title="Notes"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              <button
                className="p-1.5 text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500/10 rounded transition-colors"
                onClick={() => navigate(`/contacts/${contact.id}/tasks`)}
                title="Tasks"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </button>
              <button
                className="p-1.5 text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 rounded transition-colors"
                onClick={async () => {
                  if (window.confirm(`Are you sure you want to delete "${contact.firstName} ${contact.lastName}"?`)) {
                    try {
                      await contactService.delete(contact.id);
                      loadContacts();
                    } catch (err) {
                      console.error('Error deleting contact:', err);
                      setError('Failed to delete contact');
                    }
                  }
                }}
                title="Delete"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
        {filteredContacts.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            {searchTerm.trim() ? 'No contacts match your search' : 'No contacts found'}
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[150px]">Name</th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[150px]">Account</th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px]">Title</th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[180px]">Email</th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px]">Phone</th>
                <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 xl:px-6 py-4 text-left max-w-[150px]">
                    <button
                      onClick={() => navigate(`/contacts/${contact.id}/edit`)}
                      className="text-sm font-medium text-brand-500 hover:text-brand-600 hover:underline break-words text-left"
                    >
                      {contact.firstName} {contact.lastName}
                    </button>
                  </td>
                  <td className="px-4 xl:px-6 py-4 text-left max-w-[150px]">
                    <div className="text-sm text-gray-900 dark:text-white break-words">{getAccountName(contact.accountId)}</div>
                  </td>
                  <td className="px-4 xl:px-6 py-4 text-left max-w-[120px]">
                    <div className="text-sm text-gray-900 dark:text-white break-words">{contact.title || '-'}</div>
                  </td>
                  <td className="px-4 xl:px-6 py-4 text-left max-w-[180px]">
                    <div className="text-sm text-gray-500 dark:text-gray-400 break-words">{contact.email || '-'}</div>
                  </td>
                  <td className="px-4 xl:px-6 py-4 text-left max-w-[120px]">
                    <div className="text-sm text-gray-500 dark:text-gray-400 break-words">{contact.phone || contact.mobile || '-'}</div>
                  </td>
                  <td className="px-4 xl:px-6 py-4 text-left text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <button
                      className="p-1.5 text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500/10 rounded transition-colors"
                      onClick={() => navigate(`/contacts/${contact.id}/notes`)}
                      title="Notes"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                    <button
                      className="p-1.5 text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-500/10 rounded transition-colors"
                      onClick={() => navigate(`/contacts/${contact.id}/tasks`)}
                      title="Tasks"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </button>
                    <button
                      className="p-1.5 text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 rounded transition-colors"
                      onClick={async () => {
                        if (window.confirm(`Are you sure you want to delete "${contact.firstName} ${contact.lastName}"?`)) {
                          try {
                            await contactService.delete(contact.id);
                            loadContacts();
                          } catch (err) {
                            console.error('Error deleting contact:', err);
                            setError('Failed to delete contact');
                          }
                        }
                      }}
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filteredContacts.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            {searchTerm.trim() ? 'No contacts match your search' : 'No contacts found'}
          </div>
        )}
      </div>
    </div>
  );
}

