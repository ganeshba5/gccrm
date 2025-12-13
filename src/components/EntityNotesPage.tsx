import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { noteService } from '../services/noteService';
import { inboundEmailService } from '../services/inboundEmailService';
import { useAuth } from '../context/AuthContext';
import type { Note } from '../types/note';
import { userService } from '../services/userService';
import type { User } from '../types/user';
import EmailDetailModal from './EmailDetailModal';
import type { InboundEmail } from '../types/inboundEmail';

type EntityType = 'opportunity' | 'account' | 'contact';

// Wrapper components for each entity type
export function OpportunityNotesPage() {
  const { id } = useParams<{ id: string }>();
  return <EntityNotesPage entityType="opportunity" entityId={id || ''} />;
}

export function AccountNotesPage() {
  const { id } = useParams<{ id: string }>();
  return <EntityNotesPage entityType="account" entityId={id || ''} />;
}

export function ContactNotesPage() {
  const { id } = useParams<{ id: string }>();
  return <EntityNotesPage entityType="contact" entityId={id || ''} />;
}

function EntityNotesPage({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  // const [allNotes, setAllNotes] = useState<Note[]>([]); // Reserved for future use
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  useEffect(() => {
    if (entityId && entityType) {
      loadNotes();
      loadUsers();
    }
  }, [entityId, entityType]);

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

  const loadNotes = async () => {
    if (!entityId || !entityType) return;
    
    try {
      setLoading(true);
      let fetchedNotes: Note[] = [];
      
      if (entityType === 'opportunity') {
        fetchedNotes = await noteService.getByOpportunity(entityId);
      } else if (entityType === 'account') {
        fetchedNotes = await noteService.getByAccount(entityId);
      } else if (entityType === 'contact') {
        fetchedNotes = await noteService.getByContact(entityId);
      }
      
      // Filter notes: show public notes (isPrivate === false or undefined) or notes created by current user
      if (user) {
        const filteredNotes = fetchedNotes.filter(note => 
          !note.isPrivate || note.createdBy === user.id
        );
        setNotes(filteredNotes);
      } else {
        setNotes(fetchedNotes.filter(note => !note.isPrivate));
      }
      
      setError(null);
    } catch (err) {
      setError('Failed to load notes');
      console.error('Error loading notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !entityId || !entityType || !newNoteContent.trim()) return;

    try {
      setError(null);
      const noteData: any = {
        content: newNoteContent.trim(),
        isPrivate: isPrivate,
      };

      if (entityType === 'opportunity') {
        noteData.opportunityId = entityId;
      } else if (entityType === 'account') {
        noteData.accountId = entityId;
      } else if (entityType === 'contact') {
        noteData.contactId = entityId;
      }

      await noteService.create(noteData, user.id);
      setNewNoteContent('');
      setIsPrivate(false);
      setIsCreating(false);
      await loadNotes();
    } catch (err) {
      setError('Failed to create note');
      console.error('Error creating note:', err);
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditNoteContent(note.content);
    setEditIsPrivate(note.isPrivate || false);
  };

  const handleViewNote = async (note: Note) => {
    // For email-generated notes, show the corresponding email
    if (note.source === 'email') {
      try {
        const email = await inboundEmailService.getByNoteId(note.id, note.emailId);
        if (email) {
          setSelectedEmail(email);
          setIsEmailModalOpen(true);
        }
      } catch (error) {
        console.error('Error loading email for note:', error);
      }
    }
  };

  const handleUpdateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNoteId || !editNoteContent.trim()) return;

    try {
      setError(null);
      await noteService.update(editingNoteId, {
        content: editNoteContent.trim(),
        isPrivate: editIsPrivate,
      });
      setEditingNoteId(null);
      setEditNoteContent('');
      setEditIsPrivate(false);
      await loadNotes();
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

    try {
      await noteService.delete(noteId);
      await loadNotes();
    } catch (err) {
      setError('Failed to delete note');
      console.error('Error deleting note:', err);
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

  const getEntityName = (): string => {
    if (entityType === 'opportunity') return 'Opportunity';
    if (entityType === 'account') return 'Account';
    if (entityType === 'contact') return 'Contact';
    return 'Entity';
  };

  const getBackPath = (): string => {
    if (entityType === 'opportunity') return '/opportunities';
    if (entityType === 'account') return '/accounts';
    if (entityType === 'contact') return '/contacts';
    return '/';
  };

  if (loading) {
    return <div className="p-4">Loading notes...</div>;
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(getBackPath())}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <span className="text-4xl">📝</span>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{getEntityName()} Notes</h1>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-lg shadow-theme-sm transition-colors font-medium text-sm"
          >
            + New Note
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-error-50 border border-error-200 rounded-lg text-error-700 text-sm dark:bg-error-900/20 dark:border-error-800 dark:text-error-400">
          {error}
        </div>
      )}

      {isCreating && (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Create New Note</h2>
          <form onSubmit={handleCreateNote} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Note Content *
              </label>
              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                rows={6}
                required
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
                placeholder="Enter your note here..."
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPrivate"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4 text-brand-500 focus:ring-brand-500 border-gray-300 rounded"
              />
              <label htmlFor="isPrivate" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Private (only visible to you)
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewNoteContent('');
                  setIsPrivate(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600"
              >
                Create Note
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        {notes.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No notes found. {!isCreating && <button onClick={() => setIsCreating(true)} className="text-brand-500 hover:underline">Create one</button>}
          </div>
        ) : (
          <>
            {/* Grid Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              <div className="col-span-2">Created By</div>
              <div className="col-span-6">Content</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Actions</div>
            </div>
            {/* Grid Rows */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {notes.map((note) => {
                const isExpanded = expandedNotes.has(note.id);
                // Strip HTML tags from content for display
                const textContent = stripHtmlTags(note.content);
                const contentIsLong = textContent.length > 100;
                const isEditing = editingNoteId === note.id;
                
                if (isEditing) {
                  return (
                    <div key={note.id} className="px-6 py-4 bg-brand-50 dark:bg-brand-900/10 border-l-4 border-brand-500">
                      <form onSubmit={handleUpdateNote} className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Note Content *
                          </label>
                          <textarea
                            value={editNoteContent}
                            onChange={(e) => setEditNoteContent(e.target.value)}
                            rows={4}
                            required
                            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
                            placeholder="Enter your note here..."
                          />
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`edit-isPrivate-${note.id}`}
                            checked={editIsPrivate}
                            onChange={(e) => setEditIsPrivate(e.target.checked)}
                            className="h-4 w-4 text-brand-500 focus:ring-brand-500 border-gray-300 rounded"
                          />
                          <label htmlFor={`edit-isPrivate-${note.id}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Private (only visible to you)
                          </label>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1.5 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600"
                          >
                            Save
                          </button>
                        </div>
                      </form>
                    </div>
                  );
                }

                const displayContent = isExpanded || !contentIsLong 
                  ? textContent 
                  : truncateContent(note.content, 100);
                
                return (
                  <div key={note.id} className="grid grid-cols-12 gap-4 px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors items-center">
                    <div className="col-span-2">
                      <span className="text-sm text-gray-900 dark:text-white truncate block">
                        {getUserName(note.createdBy)}
                      </span>
                    </div>
                    <div className="col-span-6">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm text-gray-700 dark:text-gray-300 ${!isExpanded && contentIsLong ? 'truncate' : ''} ${isExpanded ? 'line-clamp-2' : ''}`}>
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
                        {new Date(note.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
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
                      {user && note.createdBy === user.id && note.source !== 'email' && (
                        <>
                          <button
                            onClick={() => handleEditNote(note)}
                            className="p-1.5 text-brand-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded transition-colors"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-1.5 text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 rounded transition-colors"
                            title="Delete"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                      {note.source === 'email' && (
                        <button
                          onClick={() => handleViewNote(note)}
                          className="p-1.5 text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
                          title="View email"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      
      {/* Email Detail Modal */}
      {selectedEmail && (
        <EmailDetailModal
          email={selectedEmail}
          isOpen={isEmailModalOpen}
          onClose={() => {
            setIsEmailModalOpen(false);
            setSelectedEmail(null);
          }}
        />
      )}
    </div>
  );
}

