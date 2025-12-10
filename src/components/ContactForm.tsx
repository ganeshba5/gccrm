import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ContactFormData } from '../types/contact';
import type { Note, NoteAttachment } from '../types/note';
import type { Task } from '../types/task';
import type { User } from '../types/user';
import { contactService } from '../services/contactService';
import { accountService } from '../services/accountService';
import { noteService } from '../services/noteService';
import { taskService } from '../services/taskService';
import { userService } from '../services/userService';
import type { Account } from '../types/account';
import { useAuth } from '../context/AuthContext';
import DatePicker from './DatePicker';
import { RichTextEditor } from './RichTextEditor';
import { NoteContent } from './NoteContent';

const initialFormData: ContactFormData = {
  firstName: '',
  lastName: '',
  accountId: '',
  email: '',
  phone: '',
  mobile: '',
  title: '',
  department: '',
  isPrimary: false,
};

export function ContactForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState<ContactFormData>(initialFormData);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'tasks'>('notes');
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [notesLoading, setNotesLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteAttachments, setNewNoteAttachments] = useState<NoteAttachment[]>([]);
  const [newNoteIsPrivate, setNewNoteIsPrivate] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status: 'not_started' as Task['status'],
    priority: 'medium' as Task['priority'],
    dueDate: '',
  });

  useEffect(() => {
    loadAccounts();
    if (id) {
      loadContact(id);
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
    // Load notes when contact ID is available
    if (id && user) {
      loadNotes(id);
      loadTasks(id);
    }
  }, [id, user]);

  const loadAccounts = async () => {
    try {
      const data = await accountService.getAll();
      setAccounts(data);
    } catch (err) {
      console.error('Error loading accounts:', err);
    }
  };

  const loadContact = async (contactId: string) => {
    try {
      setLoading(true);
      const contact = await contactService.getById(contactId);
      if (contact) {
        setFormData({
          firstName: contact.firstName,
          lastName: contact.lastName,
          accountId: contact.accountId,
          email: contact.email || '',
          phone: contact.phone || '',
          mobile: contact.mobile || '',
          title: contact.title || '',
          department: contact.department || '',
          isPrimary: contact.isPrimary || false,
        });

        // Convert embedded notes to attached Note if exists
        if (contact.notes && contact.notes.trim() && user) {
          try {
            // Check if a note already exists for this contact
            const existingNotes = await noteService.getByContact(contactId);
            const hasExistingNote = existingNotes.some(note => 
              note.content === contact.notes?.trim()
            );

            if (!hasExistingNote) {
              // Create a note from the embedded notes field
              await noteService.create({
                content: contact.notes.trim(),
                contactId: contactId,
                isPrivate: false,
              }, user.id);

              // Remove notes from contact
              await contactService.update(contactId, { notes: undefined });
              
              // Reload notes after conversion
              if (user) {
                await loadNotes(contactId);
              }
            }
          } catch (err) {
            console.error('Error converting embedded notes to Note:', err);
          }
        }
      }
    } catch (err) {
      setError('Failed to load contact');
      console.error('Error loading contact:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!formData.accountId) {
      setError('Account is required');
      setLoading(false);
      return;
    }

    if (!user) {
      setError('You must be logged in');
      setLoading(false);
      return;
    }

    try {
      // Prepare submit data - service will handle undefined values
      const submitData = {
        ...formData,
        // Convert empty strings to undefined for optional fields
        email: formData.email?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        mobile: formData.mobile?.trim() || undefined,
        title: formData.title?.trim() || undefined,
        department: formData.department?.trim() || undefined,
      };

      if (id) {
        await contactService.update(id, submitData);
      } else {
        await contactService.create(submitData, user.id);
      }
      navigate('/contacts');
    } catch (err) {
      setError('Failed to save contact');
      console.error('Error saving contact:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const loadNotes = async (contactId: string) => {
    if (!user) return;
    
    try {
      setNotesLoading(true);
      const allNotes = await noteService.getByContact(contactId);
      
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

  const loadTasks = async (contactId: string) => {
    try {
      setTasksLoading(true);
      const allTasks = await taskService.getByContact(contactId);
      setTasks(allTasks);
    } catch (err) {
      console.error('Error loading tasks:', err);
      setTasks([]);
    } finally {
      setTasksLoading(false);
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
      year: 'numeric'
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
    // Navigate to full-page edit mode
    if (id) {
      navigate(`/notes/${note.id}/edit`, { 
        state: { returnPath: `/contacts/${id}/edit` } 
      });
    } else {
      navigate(`/notes/${note.id}/edit`);
    }
  };


  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;

    try {
      await noteService.delete(noteId);
      await loadNotes(id!);
    } catch (err) {
      setError('Failed to delete note');
      console.error('Error deleting note:', err);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    // Check if content has meaningful text (strip HTML tags for validation)
    const textContent = newNoteContent.replace(/<[^>]*>/g, '').trim();
    if (!user || !id || (!textContent && newNoteAttachments.length === 0)) return;

    try {
      setError(null);
      await noteService.create({
        content: newNoteContent,
        attachments: newNoteAttachments.length > 0 ? newNoteAttachments : undefined,
        contactId: id,
        isPrivate: newNoteIsPrivate,
      }, user.id);
      setNewNoteContent('');
      setNewNoteAttachments([]);
      setNewNoteIsPrivate(false);
      setIsCreatingNote(false);
      await loadNotes(id);
    } catch (err) {
      setError('Failed to create note');
      console.error('Error creating note:', err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !newTask.title.trim()) return;

    try {
      setError(null);
      await taskService.create({
        title: newTask.title.trim(),
        description: newTask.description || undefined,
        status: newTask.status,
        priority: newTask.priority,
        dueDate: newTask.dueDate ? new Date(newTask.dueDate) : undefined,
        contactId: id,
      }, user.id);
      setNewTask({
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        dueDate: '',
      });
      setIsCreatingTask(false);
      await loadTasks(id);
    } catch (err) {
      setError('Failed to create task');
      console.error('Error creating task:', err);
    }
  };

  if (loading && id) {
    return <div className="p-4">Loading contact data...</div>;
  }

  return (
    <div className="p-6">
      <div className="w-full bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white text-left">
            {id ? 'Edit Contact' : 'New Contact'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/contacts')}
              className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
              title="Cancel"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 6L14 14M6 14L14 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="submit"
              form="contact-form"
              disabled={loading}
              className="p-1.5 rounded-full text-brand-500 hover:text-white hover:bg-brand-500 dark:text-brand-400 dark:hover:bg-brand-500 transition-colors disabled:opacity-50"
              title={loading ? 'Saving...' : 'Save Contact'}
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 10.5L8.5 14L15 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-lg text-error-700 text-sm dark:bg-error-900/20 dark:border-error-800 dark:text-error-400">
            {error}
          </div>
        )}

        <form id="contact-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Line 1: First Name, Last Name - Label and Field in one line */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="firstName" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                First Name *
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                required
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="lastName" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Last Name *
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                required
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
              />
            </div>
          </div>

          {/* Line 2: Account - Label and Field in one line */}
          <div className="flex items-center gap-2">
            <label htmlFor="accountId" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Account *
            </label>
            <select
              id="accountId"
              name="accountId"
              value={formData.accountId}
              onChange={handleInputChange}
              required
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
            >
              <option value="">Select an account</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>

          {/* Line 3: Email, Phone - Label and Field in one line */}
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
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
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
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
              />
            </div>
          </div>

          {/* Line 4: Mobile, Title (Role) - Label and Field in one line */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="mobile" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Mobile:
              </label>
              <input
                type="tel"
                id="mobile"
                name="mobile"
                value={formData.mobile || ''}
                onChange={handleInputChange}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="title" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Title (Role):
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title || ''}
                onChange={handleInputChange}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
              />
            </div>
          </div>

          {/* Line 5: Department - Label and Field */}
          <div className="flex items-center gap-2">
            <label htmlFor="department" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Department:
            </label>
            <input
              type="text"
              id="department"
              name="department"
              value={formData.department || ''}
              onChange={handleInputChange}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="isPrimary"
                checked={formData.isPrimary}
                onChange={handleInputChange}
                className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Primary Contact</span>
            </label>
          </div>
        </form>

        {/* Tabs Section: Notes, Tasks - only show when editing existing contact */}
        {id && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {/* Tab Headers */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'notes'
                      ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Notes
                </button>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'tasks'
                      ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Tasks
                </button>
              </div>
              {/* + Icon for creating new items */}
              {activeTab === 'notes' && !isCreatingNote && (
                <button
                  onClick={() => setIsCreatingNote(true)}
                  className="p-1.5 text-brand-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded transition-colors"
                  title="Create new note"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
              {activeTab === 'tasks' && !isCreatingTask && (
                <button
                  onClick={() => setIsCreatingTask(true)}
                  className="p-1.5 text-brand-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded transition-colors"
                  title="Create new task"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
            </div>

            {/* Notes Tab Content */}
            {activeTab === 'notes' && (
              <>
                {isCreatingNote && (
                  <div className="mb-4 p-4 bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-lg">
                    <form onSubmit={handleCreateNote} className="space-y-3">
                      <RichTextEditor
                        value={newNoteContent}
                        onChange={setNewNoteContent}
                        attachments={newNoteAttachments}
                        onAttachmentsChange={setNewNoteAttachments}
                        placeholder="Enter your note here..."
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="new-isPrivate"
                          checked={newNoteIsPrivate}
                          onChange={(e) => setNewNoteIsPrivate(e.target.checked)}
                          className="h-4 w-4 text-brand-500 focus:ring-brand-500 border-gray-300 rounded"
                        />
                        <label htmlFor="new-isPrivate" className="text-sm text-gray-700 dark:text-gray-300">
                          Private (only visible to you)
                        </label>
                        <div className="flex-1"></div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingNote(false);
                            setNewNoteContent('');
                            setNewNoteAttachments([]);
                            setNewNoteIsPrivate(false);
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1.5 text-sm font-medium text-white bg-brand-500 rounded hover:bg-brand-600"
                        >
                          Create Note
                        </button>
                      </div>
                    </form>
                  </div>
                )}
            
            {notesLoading ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                Loading notes...
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-3 text-gray-500 dark:text-gray-400 text-sm">
                No notes found
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {notes.map((note) => {
                  const isExpanded = expandedNotes.has(note.id);

                  return (
                    <div key={note.id} className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {getUserName(note.createdBy)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(note.createdAt)}
                            </span>
                            {note.isPrivate && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 rounded">
                                Private
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            <NoteContent
                              content={note.content}
                              attachments={note.attachments}
                              maxLength={200}
                              showFull={isExpanded}
                              onToggleExpand={() => toggleNoteExpansion(note.id)}
                              viewOnly={false}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          {user && note.createdBy === user.id && note.source !== 'email' && (
                            <>
                              <button
                                onClick={() => handleEditNote(note)}
                                className="p-1.5 text-brand-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                className="p-1.5 text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 rounded transition-colors"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
              </>
            )}

            {/* Tasks Tab Content */}
            {activeTab === 'tasks' && (
              <>
                {isCreatingTask && (
                  <div className="mb-4 p-4 bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-lg">
                    <form onSubmit={handleCreateTask} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Title *
                        </label>
                        <input
                          type="text"
                          value={newTask.title}
                          onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                          required
                          className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Description
                        </label>
                        <textarea
                          value={newTask.description}
                          onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                          rows={3}
                          className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Status
                          </label>
                          <select
                            value={newTask.status}
                            onChange={(e) => setNewTask({ ...newTask, status: e.target.value as Task['status'] })}
                            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                          >
                            <option value="not_started">Not Started</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Priority
                          </label>
                          <select
                            value={newTask.priority}
                            onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}
                            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Due Date
                        </label>
                        <DatePicker
                          value={newTask.dueDate}
                          onChange={(value) => setNewTask({ ...newTask, dueDate: value })}
                          placeholder="Select due date"
                          className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingTask(false);
                            setNewTask({
                              title: '',
                              description: '',
                              status: 'not_started',
                              priority: 'medium',
                              dueDate: '',
                            });
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1.5 text-sm font-medium text-white bg-brand-500 rounded hover:bg-brand-600"
                        >
                          Create Task
                        </button>
                      </div>
                    </form>
                  </div>
                )}
                
                {tasksLoading ? (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    Loading tasks...
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-3 text-gray-500 dark:text-gray-400 text-sm">
                    No tasks found
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto overflow-x-auto">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky top-0 min-w-[600px]">
                      <div className="col-span-3">Title</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-2">Priority</div>
                      <div className="col-span-2">Due Date</div>
                      <div className="col-span-3">Description</div>
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-gray-600">
                      {tasks.map((task) => {
                        const isExpanded = expandedTasks.has(task.id);
                        const descIsLong = task.description && task.description.length > 80;
                        const displayDesc = isExpanded || !descIsLong 
                          ? (task.description || '-')
                          : truncateContent(task.description || '', 80);
                        
                        return (
                          <div key={task.id} className="grid grid-cols-12 gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors items-center min-w-[600px]">
                            <div className="col-span-3">
                              <span className="text-xs text-gray-900 dark:text-white truncate block">
                                {task.title}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${
                                task.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                                task.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                                task.status === 'cancelled' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' :
                                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                              }`}>
                                {task.status.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${
                                task.priority === 'high' ? 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-400' :
                                task.priority === 'medium' ? 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-400' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                              }`}>
                                {task.priority}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {task.dueDate ? formatDate(task.dueDate) : '-'}
                              </span>
                            </div>
                            <div className="col-span-3">
                              <div className="flex items-center gap-1">
                                <span className={`text-xs text-gray-700 dark:text-gray-300 ${!isExpanded && descIsLong ? 'truncate' : ''}`}>
                                  {displayDesc}
                                </span>
                                {descIsLong && (
                                  <button
                                    onClick={() => {
                                      const newSet = new Set(expandedTasks);
                                      if (newSet.has(task.id)) {
                                        newSet.delete(task.id);
                                      } else {
                                        newSet.add(task.id);
                                      }
                                      setExpandedTasks(newSet);
                                    }}
                                    className="flex-shrink-0 text-xs text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
                                  >
                                    {isExpanded ? '▲' : '▼'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

