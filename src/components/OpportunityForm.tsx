import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Opportunity } from '../types/opportunity';
import type { Note, NoteAttachment } from '../types/note';
import type { Task } from '../types/task';
import type { Contact } from '../types/contact';
import type { User } from '../types/user';
import { opportunityService } from '../services/opportunityService';
import { accountService } from '../services/accountService';
import { noteService } from '../services/noteService';
import { taskService } from '../services/taskService';
import { contactService } from '../services/contactService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import DatePicker from './DatePicker';
import { RichTextEditor } from './RichTextEditor';
import { NoteContent } from './NoteContent';
import { SharedUsersManager } from './SharedUsersManager';
import type { SharedUser } from '../types/account';
import { canAccessAllData } from '../lib/auth-helpers';

export default function OpportunityForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState<Opportunity['stage']>('New');
  const [probability, setProbability] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [description, setDescription] = useState('');
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [canManageSharedUsers, setCanManageSharedUsers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'tasks' | 'contacts'>('notes');
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [notesLoading, setNotesLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
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
  const { user } = useAuth();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);

  // Load opportunity from URL params
  useEffect(() => {
    if (id) {
      opportunityService.getById(id)
        .then(loadedOpportunity => {
          if (loadedOpportunity) {
            setOpportunity(loadedOpportunity);
            setName(loadedOpportunity.name || '');
            setAccountId(loadedOpportunity.accountId || '');
            setAmount(loadedOpportunity.amount?.toString() || '');
            setStage(loadedOpportunity.stage || 'New');
            setProbability(loadedOpportunity.probability?.toString() || '');
            setExpectedCloseDate(loadedOpportunity.expectedCloseDate ? loadedOpportunity.expectedCloseDate.toISOString().split('T')[0] : '');
            setDescription(loadedOpportunity.description || '');
            setSharedUsers(loadedOpportunity.sharedUsers || []);
            
            // Check if user can manage shared users (admin or owner only)
            const checkPermissions = async () => {
              if (user) {
                const isAdmin = await canAccessAllData();
                const isOwner = loadedOpportunity.owner === user.id;
                setCanManageSharedUsers(isAdmin || isOwner);
              }
            };
            checkPermissions();
            
            // Fetch account name if accountId exists
            if (loadedOpportunity.accountId) {
              accountService.getById(loadedOpportunity.accountId)
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
            
            // Load notes, tasks, and contacts for this opportunity
            loadNotes(loadedOpportunity.id);
            loadTasks(loadedOpportunity.id);
            // Load contacts from parent account
            if (loadedOpportunity.accountId) {
              loadContacts(loadedOpportunity.accountId);
            }
          }
        })
        .catch(err => {
          console.error('Error loading opportunity:', err);
          setError('Failed to load opportunity');
        });
    }
  }, [id, user]);

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

  const loadTasks = async (opportunityId: string) => {
    try {
      setTasksLoading(true);
      const allTasks = await taskService.getByOpportunity(opportunityId);
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
    if (!editingNoteId || (!textContent && editNoteAttachments.length === 0) || !user || !opportunity) return;

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
      await loadNotes(opportunity.id);
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

  const handleViewNote = (note: Note) => {
    if (id) {
      navigate(`/notes/${note.id}/view`, { 
        state: { returnPath: `/opportunities/${id}/edit` } 
      });
    } else {
      navigate(`/notes/${note.id}/view`);
    }
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

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    // Check if content has meaningful text (strip HTML tags for validation)
    const textContent = newNoteContent.replace(/<[^>]*>/g, '').trim();
    if (!user || !opportunity || (!textContent && newNoteAttachments.length === 0)) return;

    try {
      setError(null);
      await noteService.create({
        content: newNoteContent,
        attachments: newNoteAttachments.length > 0 ? newNoteAttachments : undefined,
        opportunityId: opportunity.id,
        isPrivate: newNoteIsPrivate,
      }, user.id);
      setNewNoteContent('');
      setNewNoteAttachments([]);
      setNewNoteIsPrivate(false);
      setIsCreatingNote(false);
      await loadNotes(opportunity.id);
    } catch (err) {
      setError('Failed to create note');
      console.error('Error creating note:', err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !opportunity || !newTask.title.trim()) return;

    try {
      setError(null);
      await taskService.create({
        title: newTask.title.trim(),
        description: newTask.description || undefined,
        status: newTask.status,
        priority: newTask.priority,
        dueDate: newTask.dueDate ? new Date(newTask.dueDate) : undefined,
        opportunityId: opportunity.id,
      }, user.id);
      setNewTask({
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        dueDate: '',
      });
      setIsCreatingTask(false);
      await loadTasks(opportunity.id);
    } catch (err) {
      setError('Failed to create task');
      console.error('Error creating task:', err);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !opportunity?.accountId || !newContact.firstName.trim() || !newContact.lastName.trim()) return;

    try {
      setError(null);
      await contactService.create({
        firstName: newContact.firstName.trim(),
        lastName: newContact.lastName.trim(),
        accountId: opportunity.accountId,
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
      await loadContacts(opportunity.accountId);
    } catch (err) {
      setError('Failed to create contact');
      console.error('Error creating contact:', err);
    }
  };

  if (!id) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <div className="text-center text-gray-500 dark:text-gray-400">
            No opportunity ID provided
          </div>
        </div>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <div className="text-center text-gray-500 dark:text-gray-400">
            Loading opportunity...
          </div>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    if (opportunity) {
      setName(opportunity.name || '');
      setAccountId(opportunity.accountId || '');
      setAmount(opportunity.amount?.toString() || '');
      setStage(opportunity.stage || 'New');
      setProbability(opportunity.probability?.toString() || '');
      setExpectedCloseDate(opportunity.expectedCloseDate ? opportunity.expectedCloseDate.toISOString().split('T')[0] : '');
      setDescription(opportunity.description || '');
      setSharedUsers(opportunity.sharedUsers || []);
    }
    setError(null);
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
      updateData.sharedUsers = sharedUsers.length > 0 ? sharedUsers : null;

      await opportunityService.update(opportunity.id, updateData);
      
      resetForm();
      navigate('/opportunities');
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
    <div className="p-6">
      <div className="w-full bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/opportunities')}
              className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
              title="Back to Opportunities"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white text-left">
              Edit Opportunity
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Shared Users Button - only show for admins and owners */}
            {user && canManageSharedUsers && (
              <SharedUsersManager
                sharedUsers={sharedUsers}
                onSharedUsersChange={setSharedUsers}
                disabled={loading}
                currentUserId={user.id}
              />
            )}
            {/* Cancel and Save buttons as icons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/opportunities')}
                className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
                title="Cancel"
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 6L14 14M6 14L14 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="submit"
                form="edit-opportunity-form"
                disabled={loading}
                className="p-1.5 rounded-full text-brand-500 hover:text-white hover:bg-brand-500 dark:text-brand-400 dark:hover:bg-brand-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={loading ? 'Saving...' : 'Save Opportunity'}
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 10.5L8.5 14L15 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-lg text-error-700 text-sm dark:bg-error-900/20 dark:border-error-800 dark:text-error-400">
            {error}
          </div>
        )}

        <form id="edit-opportunity-form" onSubmit={handleSubmit} className="space-y-4">
          {/* First row: Opportunity Name, Account */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Opportunity Name *
              </label>
              <input
                type="text"
                id="name"
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed" 
                required 
                disabled={loading}
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="account" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Account:
              </label>
              <input 
                id="account"
                value={accountName || accountId || ''} 
                readOnly
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-700" 
                disabled={true}
                placeholder={accountId ? 'Loading account name...' : 'No account'}
              />
            </div>
          </div>

          {/* Second row: Amount, Stage, Probability, Close Date */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="amount" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Amount:
              </label>
              <input 
                type="number"
                id="amount"
                step="0.01"
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed" 
                disabled={loading}
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="stage" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Stage:
              </label>
              <select
                id="stage"
                value={stage}
                onChange={e => setStage(e.target.value as Opportunity['stage'])}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
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
            <div className="flex items-center gap-2">
              <label htmlFor="probability" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Probability (%):
              </label>
              <input 
                type="number"
                id="probability"
                min="0"
                max="100"
                value={probability} 
                onChange={e => setProbability(e.target.value)} 
                className="w-20 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed" 
                disabled={loading}
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="closeDate" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Close Date:
              </label>
              <DatePicker
                value={expectedCloseDate}
                onChange={setExpectedCloseDate}
                placeholder="Select close date"
                disabled={loading}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Description: Reduced height */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 text-left mb-1">
              Description
            </label>
            <textarea 
              id="description"
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed" 
              rows={3}
              disabled={loading}
            />
          </div>
        </form>

        {/* Tabs Section: Notes, Tasks, Contacts */}
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
              {opportunity?.accountId && (
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
              )}
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
            {activeTab === 'contacts' && opportunity?.accountId && !isCreatingContact && (
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
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {notes.map((note) => {
                const isExpanded = expandedNotes.has(note.id);
                const isEditing = editingNoteId === note.id;
                if (isEditing) {
                  return (
                    <div key={note.id} className="p-4 bg-brand-50 dark:bg-brand-900/10 border-l-4 border-brand-500 rounded-lg">
                      <form onSubmit={handleUpdateNote} className="space-y-3">
                        <RichTextEditor
                          value={editNoteContent}
                          onChange={setEditNoteContent}
                          attachments={editNoteAttachments}
                          onAttachmentsChange={setEditNoteAttachments}
                          placeholder="Enter your note here..."
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`edit-isPrivate-${note.id}`}
                              checked={editIsPrivate}
                              onChange={(e) => setEditIsPrivate(e.target.checked)}
                              className="h-4 w-4 text-brand-500 focus:ring-brand-500 border-gray-300 rounded"
                            />
                            <label htmlFor={`edit-isPrivate-${note.id}`} className="text-sm text-gray-700 dark:text-gray-300">
                              Private
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-1.5 text-sm font-medium text-white bg-brand-500 rounded hover:bg-brand-600"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  );
                }

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
                        {user && note.createdBy === user.id ? (
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
                        ) : (
                          <button
                            onClick={() => handleViewNote(note)}
                            className="p-1.5 text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
                            title="View full note"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
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

          {/* Contacts Tab Content */}
          {activeTab === 'contacts' && opportunity?.accountId && (
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
                  No contacts found for this account
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
        </div>
      </div>
    </div>
  );
}

