import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import type { AccountFormData } from '../types/account';
import type { Note, NoteAttachment } from '../types/note';
import type { Task } from '../types/task';
import type { Contact } from '../types/contact';
import type { Opportunity } from '../types/opportunity';
import type { User } from '../types/user';
import { accountService } from '../services/accountService';
import { opportunityService } from '../services/opportunityService';
import { noteService } from '../services/noteService';
import { taskService } from '../services/taskService';
import { contactService } from '../services/contactService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { canAccessAllData } from '../lib/auth-helpers';
import DatePicker from './DatePicker';
import { RichTextEditor } from './RichTextEditor';
import { NoteContent } from './NoteContent';

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
  const [searchParams] = useSearchParams();
  const isViewMode = location.pathname.includes('/view');
  const fromOpportunities = searchParams.get('from') === 'opportunities';
  const { user } = useAuth();
  const [formData, setFormData] = useState<AccountFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(isViewMode);
  const [readOnlyReason, setReadOnlyReason] = useState<string | null>(isViewMode ? 'View only mode' : null);
  const [, setAccount] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'tasks' | 'contacts' | 'opportunities'>('notes');
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [notesLoading, setNotesLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editNoteAttachments, setEditNoteAttachments] = useState<NoteAttachment[]>([]);
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isCreatingContact, setIsCreatingContact] = useState(false);
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
  const [newContact, setNewContact] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    mobile: '',
    title: '',
    department: '',
  });

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
      loadTasks(id);
      loadContacts(id);
      loadOpportunities(id);
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

  const loadTasks = async (accountId: string) => {
    try {
      setTasksLoading(true);
      const allTasks = await taskService.getByAccount(accountId);
      setTasks(allTasks);
    } catch (err) {
      console.error('Error loading tasks:', err);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  const loadContacts = async (accountId: string) => {
    try {
      setContactsLoading(true);
      const allContacts = await contactService.getByAccount(accountId);
      setContacts(allContacts);
    } catch (err) {
      console.error('Error loading contacts:', err);
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  const loadOpportunities = async (accountId: string) => {
    try {
      setOpportunitiesLoading(true);
      const allOpportunities = await opportunityService.getByAccount(accountId);
      setOpportunities(allOpportunities);
    } catch (err) {
      console.error('Error loading opportunities:', err);
      setOpportunities([]);
    } finally {
      setOpportunitiesLoading(false);
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
    setEditingNoteId(note.id);
    setEditNoteContent(note.content);
    setEditNoteAttachments(note.attachments || []);
    setEditIsPrivate(note.isPrivate || false);
  };

  const handleUpdateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    // Check if content has meaningful text (strip HTML tags for validation)
    const textContent = editNoteContent.replace(/<[^>]*>/g, '').trim();
    if (!editingNoteId || (!textContent && editNoteAttachments.length === 0) || !user) return;

    try {
      setError(null);
      await noteService.update(editingNoteId, {
        content: editNoteContent,
        attachments: editNoteAttachments.length > 0 ? editNoteAttachments : undefined,
        isPrivate: editIsPrivate,
      });
      setEditingNoteId(null);
      setEditNoteContent('');
      setEditNoteAttachments([]);
      setEditIsPrivate(false);
      await loadNotes(id!);
    } catch (err) {
      setError('Failed to update note');
      console.error('Error updating note:', err);
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditNoteContent('');
    setEditNoteAttachments([]);
    setEditIsPrivate(false);
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
        accountId: id,
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
        accountId: id,
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

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !newContact.firstName.trim() || !newContact.lastName.trim()) return;

    try {
      setError(null);
      await contactService.create({
        firstName: newContact.firstName.trim(),
        lastName: newContact.lastName.trim(),
        accountId: id,
        email: newContact.email.trim() || undefined,
        phone: newContact.phone.trim() || undefined,
        mobile: newContact.mobile.trim() || undefined,
        title: newContact.title.trim() || undefined,
        department: newContact.department.trim() || undefined,
      }, user.id);
      setNewContact({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        mobile: '',
        title: '',
        department: '',
      });
      setIsCreatingContact(false);
      await loadContacts(id);
    } catch (err) {
      setError('Failed to create contact');
      console.error('Error creating contact:', err);
    }
  };

  if (loading && id) {
    return <div className="p-4">Loading account data...</div>;
  }

  return (
    <>
      {/* Breadcrumb Navigation */}
      {fromOpportunities && (
        <div className="px-6 pt-4 pb-2">
          <nav className="flex items-center space-x-2 text-sm">
            <button
              onClick={() => navigate('/opportunities')}
              className="text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
            >
              Opportunities
            </button>
            <span className="text-gray-400 dark:text-gray-500">/</span>
            <span className="text-gray-700 dark:text-gray-300">{formData.name || 'Account'}</span>
          </nav>
        </div>
      )}
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

        {/* Tabs Section: Notes, Tasks, Contacts, Opportunities - only show when editing existing account */}
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
                <button
                  onClick={() => setActiveTab('contacts')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'contacts'
                      ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Contacts
                </button>
                <button
                  onClick={() => setActiveTab('opportunities')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'opportunities'
                      ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Opportunities
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
              {activeTab === 'contacts' && !isCreatingContact && (
                <button
                  onClick={() => setIsCreatingContact(true)}
                  className="p-1.5 text-brand-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded transition-colors"
                  title="Create new contact"
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
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto">
                {/* Grid Header */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky top-0">
                  <div className="col-span-3">Created By</div>
                  <div className="col-span-4">Content</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-2">Actions</div>
                </div>
                {/* Grid Rows */}
                <div className="divide-y divide-gray-200 dark:divide-gray-600">
                  {notes.map((note) => {
                    const isExpanded = expandedNotes.has(note.id);
                    const isEditing = editingNoteId === note.id;
                    
                    if (isEditing) {
                      return (
                        <div key={note.id} className="px-3 py-3 bg-brand-50 dark:bg-brand-900/10 border-l-4 border-brand-500">
                          <form onSubmit={handleUpdateNote} className="space-y-2">
                            <RichTextEditor
                              value={editNoteContent}
                              onChange={setEditNoteContent}
                              attachments={editNoteAttachments}
                              onAttachmentsChange={setEditNoteAttachments}
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
                    
                    return (
                      <div key={note.id} className="grid grid-cols-12 gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors items-start">
                        <div className="col-span-3">
                          <span className="text-xs text-gray-900 dark:text-white truncate block">
                            {getUserName(note.createdBy)}
                          </span>
                        </div>
                        <div className="col-span-4">
                          <NoteContent
                            content={note.content}
                            attachments={note.attachments}
                            maxLength={80}
                            showFull={isExpanded}
                            onToggleExpand={() => toggleNoteExpansion(note.id)}
                          />
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
                          {user && note.createdBy === user.id && (
                            <>
                              <button
                                onClick={() => handleEditNote(note)}
                                className="p-1 text-brand-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                className="p-1 text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 rounded transition-colors"
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
                    );
                  })}
                </div>
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

            {/* Contacts Tab Content */}
            {activeTab === 'contacts' && (
              <>
                {isCreatingContact && (
                  <div className="mb-4 p-4 bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-lg">
                    <form onSubmit={handleCreateContact} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            First Name *
                          </label>
                          <input
                            type="text"
                            value={newContact.firstName}
                            onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
                            required
                            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Last Name *
                          </label>
                          <input
                            type="text"
                            value={newContact.lastName}
                            onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                            required
                            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={newContact.email}
                            onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={newContact.phone}
                            onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Mobile
                          </label>
                          <input
                            type="tel"
                            value={newContact.mobile}
                            onChange={(e) => setNewContact({ ...newContact, mobile: e.target.value })}
                            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Title
                          </label>
                          <input
                            type="text"
                            value={newContact.title}
                            onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
                            className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Department
                        </label>
                        <input
                          type="text"
                          value={newContact.department}
                          onChange={(e) => setNewContact({ ...newContact, department: e.target.value })}
                          className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1"></div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingContact(false);
                            setNewContact({
                              firstName: '',
                              lastName: '',
                              email: '',
                              phone: '',
                              mobile: '',
                              title: '',
                              department: '',
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
                          Create Contact
                        </button>
                      </div>
                    </form>
                  </div>
                )}
                {contactsLoading ? (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    Loading contacts...
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="text-center py-3 text-gray-500 dark:text-gray-400 text-sm">
                    No contacts found
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky top-0">
                      <div className="col-span-3">Name</div>
                      <div className="col-span-3">Email</div>
                      <div className="col-span-2">Phone</div>
                      <div className="col-span-2">Title</div>
                      <div className="col-span-2">Department</div>
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-gray-600">
                      {contacts.map((contact) => (
                        <div key={contact.id} className="grid grid-cols-12 gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors items-center">
                          <div className="col-span-3">
                            <span className="text-xs text-gray-900 dark:text-white truncate block">
                              {contact.firstName} {contact.lastName}
                            </span>
                          </div>
                          <div className="col-span-3">
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate block">
                              {contact.email || '-'}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate block">
                              {contact.phone || contact.mobile || '-'}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate block">
                              {contact.title || '-'}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate block">
                              {contact.department || '-'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Opportunities Tab Content */}
            {activeTab === 'opportunities' && (
              <>
                {opportunitiesLoading ? (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    Loading opportunities...
                  </div>
                ) : opportunities.length === 0 ? (
                  <div className="text-center py-3 text-gray-500 dark:text-gray-400 text-sm">
                    No opportunities found
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky top-0">
                      <div className="col-span-4">Name</div>
                      <div className="col-span-2">Stage</div>
                      <div className="col-span-2">Amount</div>
                      <div className="col-span-2">Close Date</div>
                      <div className="col-span-2">Owner</div>
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-gray-600">
                      {opportunities.map((opp) => (
                        <div key={opp.id} className="grid grid-cols-12 gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors items-center">
                          <div className="col-span-4">
                            <span className="text-xs text-gray-900 dark:text-white truncate block">
                              {opp.name}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate block">
                              {opp.stage}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate block">
                              {opp.amount ? `$${opp.amount.toLocaleString()}` : '-'}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate block">
                              {opp.expectedCloseDate ? formatDate(opp.expectedCloseDate) : '-'}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate block">
                              {getUserName(opp.owner)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

