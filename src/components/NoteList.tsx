import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Note } from '../types/note';
import { noteService } from '../services/noteService';
import { accountService } from '../services/accountService';
import { contactService } from '../services/contactService';
import { opportunityService } from '../services/opportunityService';
import type { Account } from '../types/account';
import type { Contact } from '../types/contact';
import type { Opportunity } from '../types/opportunity';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';
import type { User } from '../types/user';

export function NoteList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterId, setFilterId] = useState<string>('');
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAccounts();
    loadContacts();
    loadOpportunities();
    loadUsers();
    loadNotes();
  }, []);

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

  useEffect(() => {
    if (filterType !== 'all' && filterId) {
      loadFilteredNotes();
    } else {
      loadNotes();
    }
  }, [filterType, filterId]);

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
      const data = await contactService.getAll();
      setContacts(data);
    } catch (err) {
      console.error('Error loading contacts:', err);
    }
  };

  const loadOpportunities = async () => {
    try {
      const data = await opportunityService.getAll();
      setOpportunities(data);
    } catch (err) {
      console.error('Error loading opportunities:', err);
    }
  };

  const loadNotes = async () => {
    try {
      setLoading(true);
      const data = await noteService.getAll();
      // Filter out private notes that user didn't create
      const filtered = data.filter(note => !note.isPrivate || note.createdBy === user?.id);
      setNotes(filtered);
      setError(null);
    } catch (err) {
      setError('Failed to load notes');
      console.error('Error loading notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFilteredNotes = async () => {
    try {
      setLoading(true);
      let data: Note[] = [];
      if (filterType === 'account' && filterId) {
        data = await noteService.getByAccount(filterId);
      } else if (filterType === 'contact' && filterId) {
        data = await noteService.getByContact(filterId);
      } else if (filterType === 'opportunity' && filterId) {
        data = await noteService.getByOpportunity(filterId);
      }
      const filtered = data.filter(note => !note.isPrivate || note.createdBy === user?.id);
      setNotes(filtered);
      setError(null);
    } catch (err) {
      setError('Failed to load notes');
      console.error('Error loading notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEntityName = (note: Note) => {
    if (note.accountId) {
      const account = accounts.find(a => a.id === note.accountId);
      return account?.name || note.accountId;
    }
    if (note.contactId) {
      const contact = contacts.find(c => c.id === note.contactId);
      return contact ? `${contact.firstName} ${contact.lastName}` : note.contactId;
    }
    if (note.opportunityId) {
      const opportunity = opportunities.find(o => o.id === note.opportunityId);
      return opportunity?.name || note.opportunityId;
    }
    return 'General';
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

  const getUserName = (userId: string): string => {
    const userData = users.get(userId);
    if (userData) {
      return userData.displayName || 
             (userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : '') ||
             userData.email;
    }
    return userId;
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

  // Strip HTML tags to get plain text
  const stripHtmlTags = (html: string): string => {
    return html.replace(/<[^>]*>/g, '');
  };

  const truncateContent = (content: string, maxLength: number = 100): string => {
    // Strip HTML first, then truncate
    const textContent = stripHtmlTags(content);
    if (textContent.length <= maxLength) return textContent;
    return textContent.substring(0, maxLength) + '...';
  };

  if (loading) {
    return <div className="p-4">Loading notes...</div>;
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-6">
      <div className="flex gap-3 mb-4">
        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setFilterId('');
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
        >
          <option value="all">All Notes</option>
          <option value="account">By Account</option>
          <option value="contact">By Contact</option>
          <option value="opportunity">By Opportunity</option>
        </select>
        {filterType !== 'all' && (
          <select
            value={filterId}
            onChange={(e) => setFilterId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
          >
            <option value="">Select...</option>
            {filterType === 'account' && accounts.map(account => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
            {filterType === 'contact' && contacts.map(contact => (
              <option key={contact.id} value={contact.id}>
                {contact.firstName} {contact.lastName}
              </option>
            ))}
            {filterType === 'opportunity' && opportunities.map(opportunity => (
              <option key={opportunity.id} value={opportunity.id}>{opportunity.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="p-4 text-error-600 dark:text-error-400">
          {error}
          <button 
            onClick={loadNotes}
            className="ml-4 text-brand-500 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Mobile/Tablet Card View */}
      <div className="lg:hidden space-y-4">
        {notes.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No notes found
          </div>
        ) : (
          notes.map((note) => {
            const isExpanded = expandedNotes.has(note.id);
            const textContent = stripHtmlTags(note.content);
            const contentIsLong = textContent.length > 100;
            const displayContent = isExpanded || !contentIsLong 
              ? textContent 
              : truncateContent(note.content, 100);
            
            return (
              <div key={note.id} className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white break-words">
                      {getEntityName(note)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {getUserName(note.createdBy)} • {formatDate(note.createdAt)}
                    </div>
                  </div>
                  {note.isPrivate && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 rounded flex-shrink-0">
                      Private
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300 break-words">
                  {displayContent}
                  {contentIsLong && (
                    <button
                      onClick={() => toggleNoteExpansion(note.id)}
                      className="ml-2 text-xs text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
                      title={isExpanded ? "Show less" : "Show more"}
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <button
                    className="p-1.5 text-brand-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded transition-colors"
                    onClick={() => navigate(`/notes/${note.id}/edit`)}
                    title="Edit"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    className="p-1.5 text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 rounded transition-colors"
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to delete this note?')) {
                        try {
                          await noteService.delete(note.id);
                          if (filterType !== 'all' && filterId) {
                            loadFilteredNotes();
                          } else {
                            loadNotes();
                          }
                        } catch (err) {
                          console.error('Error deleting note:', err);
                          setError('Failed to delete note');
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
            );
          })
        )}
      </div>

      {/* Desktop Grid View */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          {notes.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No notes found
            </div>
          ) : (
            <>
              {/* Grid Header */}
              <div className="grid grid-cols-12 gap-4 px-4 xl:px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                <div className="col-span-2">Entity</div>
                <div className="col-span-2">Created By</div>
                <div className="col-span-4 text-left">Content</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-1">Actions</div>
              </div>
              {/* Grid Rows */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {notes.map((note) => {
                  const isExpanded = expandedNotes.has(note.id);
                  const textContent = stripHtmlTags(note.content);
                  const contentIsLong = textContent.length > 100;
                  const displayContent = isExpanded || !contentIsLong 
                    ? textContent 
                    : truncateContent(note.content, 100);
                  
                  return (
                    <div key={note.id} className="grid grid-cols-12 gap-4 px-4 xl:px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors items-center">
                      <div className="col-span-2 max-w-[150px]">
                        <span className="text-sm text-gray-900 dark:text-white break-words block">
                          {getEntityName(note)}
                        </span>
                      </div>
                      <div className="col-span-2 max-w-[150px]">
                        <span className="text-sm text-gray-900 dark:text-white break-words block">
                          {getUserName(note.createdBy)}
                        </span>
                      </div>
                      <div className="col-span-4 max-w-[400px]">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm text-gray-700 dark:text-gray-300 text-left break-words ${isExpanded ? 'line-clamp-2' : ''}`}>
                            {displayContent}
                          </span>
                          {contentIsLong && (
                            <button
                              onClick={() => toggleNoteExpansion(note.id)}
                              className="flex-shrink-0 text-xs text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1"
                              title={isExpanded ? "Show less" : "Show more"}
                            >
                              {isExpanded ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {formatDate(note.createdAt)}
                        </span>
                      </div>
                      <div className="col-span-1">
                        {note.isPrivate && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 rounded whitespace-nowrap">
                            Private
                          </span>
                        )}
                      </div>
                      <div className="col-span-1 flex items-center justify-end gap-1">
                      <button
                        className="p-1.5 text-brand-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded transition-colors"
                        onClick={() => navigate(`/notes/${note.id}/edit`)}
                        title="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        className="p-1.5 text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 rounded transition-colors"
                        onClick={async () => {
                          if (window.confirm('Are you sure you want to delete this note?')) {
                            try {
                              await noteService.delete(note.id);
                              if (filterType !== 'all' && filterId) {
                                loadFilteredNotes();
                              } else {
                                loadNotes();
                              }
                            } catch (err) {
                              console.error('Error deleting note:', err);
                              setError('Failed to delete note');
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
                );
              })}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

