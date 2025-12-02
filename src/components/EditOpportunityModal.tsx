import { useState, useEffect, type FormEvent } from 'react';
import type { Opportunity } from '../types/opportunity';
import type { Note } from '../types/note';
import type { User } from '../types/user';
import { opportunityService } from '../services/opportunityService';
import { accountService } from '../services/accountService';
import { noteService } from '../services/noteService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import DatePicker from './DatePicker';

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
  const [notes, setNotes] = useState<Note[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [notesLoading, setNotesLoading] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(false);
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
      
      // Load notes for this opportunity
      if (opportunity.id) {
        loadNotes(opportunity.id);
      }
    }
  }, [opportunity]);

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

  const loadNotes = async (opportunityId: string) => {
    if (!user) return;
    
    try {
      setNotesLoading(true);
      const allNotes = await noteService.getByOpportunity(opportunityId);
      
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

  const handleEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditNoteContent(note.content);
    setEditIsPrivate(note.isPrivate || false);
  };

  const handleUpdateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNoteId || !editNoteContent.trim() || !user || !opportunity) return;

    try {
      setError(null);
      await noteService.update(editingNoteId, {
        content: editNoteContent.trim(),
        isPrivate: editIsPrivate,
      });
      setEditingNoteId(null);
      setEditNoteContent('');
      setEditIsPrivate(false);
      await loadNotes(opportunity.id);
    } catch (err) {
      setError('Failed to update note');
      console.error('Error updating note:', err);
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditNoteContent('');
    setEditIsPrivate(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    if (!opportunity) return;

    try {
      await noteService.delete(noteId);
      await loadNotes(opportunity.id);
    } catch (err) {
      setError('Failed to delete note');
      console.error('Error deleting note:', err);
    }
  };

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
    <div className="fixed inset-0 bg-black/40 flex justify-center items-start z-50 overflow-y-auto pt-24 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-lg w-full max-w-2xl mb-8 px-4 sm:px-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Edit Opportunity</h3>
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
              form="edit-opportunity-form"
              className="p-1.5 rounded-full text-brand-500 hover:text-white hover:bg-brand-500 dark:text-brand-400 dark:hover:bg-brand-500 transition-colors disabled:opacity-50"
              title="Save"
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

        <form id="edit-opportunity-form" onSubmit={handleSubmit} className="space-y-3">
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
                <input 
                  value={accountName || accountId || ''} 
                  readOnly
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm cursor-not-allowed" 
                  disabled={true}
                  placeholder={accountId ? 'Loading account name...' : 'No account'}
                />
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

        {/* Notes Section */}
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
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto overflow-x-auto">
              {/* Grid Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky top-0 min-w-[600px]">
                <div className="col-span-2">Created By</div>
                <div className="col-span-5">Content</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-2">Actions</div>
              </div>
              {/* Grid Rows */}
              <div className="divide-y divide-gray-200 dark:divide-gray-600">
                {notes.map((note) => {
                  const isExpanded = expandedNotes.has(note.id);
                  const contentIsLong = note.content.length > 80;
                  const isEditing = editingNoteId === note.id;
                  
                  if (isEditing) {
                    return (
                      <div key={note.id} className="px-3 py-3 bg-brand-50 dark:bg-brand-900/10 border-l-4 border-brand-500">
                        <form onSubmit={handleUpdateNote} className="space-y-2">
                          <textarea
                            value={editNoteContent}
                            onChange={(e) => setEditNoteContent(e.target.value)}
                            rows={3}
                            required
                            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                            placeholder="Enter your note here..."
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`edit-isPrivate-${note.id}`}
                              checked={editIsPrivate}
                              onChange={(e) => setEditIsPrivate(e.target.checked)}
                              className="h-3 w-3 text-brand-500 focus:ring-brand-500 border-gray-300 rounded"
                            />
                            <label htmlFor={`edit-isPrivate-${note.id}`} className="text-xs text-gray-700 dark:text-gray-300">
                              Private
                            </label>
                            <div className="flex-1"></div>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-2 py-1 text-xs font-medium text-white bg-brand-500 rounded hover:bg-brand-600"
                            >
                              Save
                            </button>
                          </div>
                        </form>
                      </div>
                    );
                  }

                  const displayContent = isExpanded || !contentIsLong 
                    ? note.content 
                    : truncateContent(note.content, 80);
                  
                  return (
                    <div key={note.id} className="grid grid-cols-12 gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors items-center min-w-[600px]">
                      <div className="col-span-2">
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
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <button
                          onClick={() => user && note.createdBy === user.id && handleEditNote(note)}
                          disabled={!user || note.createdBy !== user.id}
                          className={`p-1 rounded transition-colors ${
                            user && note.createdBy === user.id
                              ? 'text-brand-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 cursor-pointer'
                              : 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50'
                          }`}
                          title={user && note.createdBy === user.id ? "Edit" : "You can only edit notes you created"}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => user && note.createdBy === user.id && handleDeleteNote(note.id)}
                          disabled={!user || note.createdBy !== user.id}
                          className={`p-1 rounded transition-colors ${
                            user && note.createdBy === user.id
                              ? 'text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 cursor-pointer'
                              : 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50'
                          }`}
                          title={user && note.createdBy === user.id ? "Delete" : "You can only delete notes you created"}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

