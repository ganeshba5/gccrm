import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { TaskFormData } from '../types/task';
import type { User } from '../types/user';
import { taskService } from '../services/taskService';
import { accountService } from '../services/accountService';
import { contactService } from '../services/contactService';
import { opportunityService } from '../services/opportunityService';
import { userService } from '../services/userService';
import type { Account } from '../types/account';
import type { Contact } from '../types/contact';
import type { Opportunity } from '../types/opportunity';
import DatePicker from './DatePicker';
import { useAuth } from '../context/AuthContext';
import { canAccessAllData } from '../lib/auth-helpers';

const initialFormData: TaskFormData = {
  title: '',
  description: '',
  status: 'not_started',
  priority: 'medium',
  dueDate: undefined,
  accountId: '',
  contactId: '',
  opportunityId: '',
  assignedTo: '',
};

export function TaskForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState<TaskFormData>(initialFormData);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignedUser, setAssignedUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      // Check admin status first
      try {
        const admin = await canAccessAllData();
        setIsAdmin(admin);
        
        // Load users if admin
        if (admin) {
          try {
            const usersData = await userService.getAll();
            setUsers(usersData);
          } catch (err) {
            console.error('Error loading users:', err);
          }
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
        setIsAdmin(false);
      }
      
      // Load other data
      loadAccounts();
      loadContacts();
      loadOpportunities();
      
      if (id) {
        loadTask(id);
      } else if (user) {
        // For new tasks, set default assignedTo to current user if not admin
        // We'll set this after admin check completes
        const adminStatus = await canAccessAllData();
        setIsAdmin(adminStatus);
        if (!adminStatus) {
          setFormData(prev => ({ ...prev, assignedTo: user.id }));
        }
      }
    };
    
    initialize();
  }, [id, user]);

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

  const loadTask = async (taskId: string) => {
    try {
      setLoading(true);
      const task = await taskService.getById(taskId);
      if (task) {
        setFormData({
          title: task.title,
          description: task.description || '',
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          accountId: task.accountId || '',
          contactId: task.contactId || '',
          opportunityId: task.opportunityId || '',
          assignedTo: task.assignedTo || '',
        });
        
        // Load assigned user if not admin and task has assignedTo
        const adminStatus = await canAccessAllData();
        setIsAdmin(adminStatus);
        if (task.assignedTo && !adminStatus) {
          try {
            const assignedUserData = await userService.getById(task.assignedTo);
            if (assignedUserData) {
              setAssignedUser(assignedUserData);
            }
          } catch (err) {
            console.error('Error loading assigned user:', err);
          }
        }
      }
    } catch (err) {
      setError('Failed to load task');
      console.error('Error loading task:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!user) {
      setError('You must be logged in');
      setLoading(false);
      return;
    }

    try {
      const submitData = {
        ...formData,
        description: formData.description || undefined,
        dueDate: formData.dueDate || undefined,
        accountId: formData.accountId || undefined,
        contactId: formData.contactId || undefined,
        opportunityId: formData.opportunityId || undefined,
        assignedTo: formData.assignedTo || undefined,
      };

      if (id) {
        await taskService.update(id, submitData);
      } else {
        await taskService.create(submitData, user.id);
      }
      navigate('/tasks');
    } catch (err) {
      setError('Failed to save task');
      console.error('Error saving task:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // If accountId changes, clear contactId and opportunityId
    if (name === 'accountId') {
      setFormData(prev => ({ 
        ...prev, 
        accountId: value,
        contactId: '', // Clear contact when account changes
        opportunityId: '', // Clear opportunity when account changes
      }));
    } else {
      setFormData(prev => ({ 
        ...prev, 
        [name]: type === 'date' ? (value ? new Date(value) : undefined) : value 
      }));
    }
  };

  // Filter contacts and opportunities based on selected account
  const filteredContacts = formData.accountId 
    ? contacts.filter(contact => contact.accountId === formData.accountId)
    : [];
  
  const filteredOpportunities = formData.accountId
    ? opportunities.filter(opportunity => opportunity.accountId === formData.accountId)
    : [];

  // Get display name for assigned user
  const getAssignedUserName = (userId: string): string => {
    if (!userId) return '';
    
    // Check if it's the current user
    if (user && user.id === userId) {
      return user.displayName || 
        (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : '') ||
        user.email ||
        userId;
    }
    
    // Check in users list (for admins)
    const foundUser = users.find(u => u.id === userId);
    if (foundUser) {
      return foundUser.displayName || 
        (foundUser.firstName && foundUser.lastName ? `${foundUser.firstName} ${foundUser.lastName}` : '') ||
        foundUser.email ||
        userId;
    }
    
    // Check assignedUser state (for non-admins editing)
    if (assignedUser && assignedUser.id === userId) {
      return assignedUser.displayName || 
        (assignedUser.firstName && assignedUser.lastName ? `${assignedUser.firstName} ${assignedUser.lastName}` : '') ||
        assignedUser.email ||
        userId;
    }
    
    return userId;
  };

  if (loading && id) {
    return <div className="p-4">Loading task data...</div>;
  }

  return (
    <div className="p-6">
      <div className="w-full bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white text-left">
            {id ? 'Edit Task' : 'New Task'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/tasks')}
              className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
              title="Cancel"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 6L14 14M6 14L14 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="submit"
              form="task-form"
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

        <form id="task-form" onSubmit={handleSubmit} className="space-y-3">
          {/* Line 1: Title */}
          <div className="flex items-center gap-2">
            <label htmlFor="title" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
              Title:
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
            />
          </div>

          {/* Line 2: Status, Priority, Due Date */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="status" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
                Status:
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                required
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="priority" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
                Priority:
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                required
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="dueDate" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
                Due Date:
              </label>
              <DatePicker
                value={formData.dueDate ? new Date(formData.dueDate).toISOString().split('T')[0] : ''}
                onChange={(value) => {
                  setFormData(prev => ({
                    ...prev,
                    dueDate: value ? new Date(value) : undefined
                  }));
                }}
                placeholder="Select due date"
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
              />
            </div>
          </div>

          {/* Line 3: Contact, Opportunity, Assigned To */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="contactId" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
                Contact:
              </label>
              <select
                id="contactId"
                name="contactId"
                value={formData.contactId}
                onChange={handleInputChange}
                disabled={!formData.accountId}
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500 dark:disabled:text-gray-400"
              >
                <option value="">None</option>
                {filteredContacts.map(contact => (
                  <option key={contact.id} value={contact.id}>
                    {contact.firstName} {contact.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="opportunityId" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
                Opportunity:
              </label>
              <select
                id="opportunityId"
                name="opportunityId"
                value={formData.opportunityId}
                onChange={handleInputChange}
                disabled={!formData.accountId}
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500 dark:disabled:text-gray-400"
              >
                <option value="">None</option>
                {filteredOpportunities.map(opportunity => (
                  <option key={opportunity.id} value={opportunity.id}>{opportunity.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="assignedTo" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
                Assigned To:
              </label>
              {isAdmin ? (
                <select
                  id="assignedTo"
                  name="assignedTo"
                  value={formData.assignedTo}
                  onChange={handleInputChange}
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                >
                  <option value="">None</option>
                  {users.map(userItem => {
                    const displayName = userItem.displayName || 
                      (userItem.firstName && userItem.lastName ? `${userItem.firstName} ${userItem.lastName}` : '') ||
                      userItem.email ||
                      userItem.id;
                    return (
                      <option key={userItem.id} value={userItem.id}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  type="text"
                  id="assignedTo"
                  value={getAssignedUserName(formData.assignedTo || user?.id || '')}
                  disabled
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
              )}
            </div>
          </div>

          {/* Line 4: Account */}
          <div className="flex items-center gap-2">
            <label htmlFor="accountId" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
              Account:
            </label>
            <select
              id="accountId"
              name="accountId"
              value={formData.accountId}
              onChange={handleInputChange}
              className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
            >
              <option value="">None</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>

          {/* Line 5: Description Label (left aligned) */}
          <div>
            <label htmlFor="description" className="text-sm font-medium text-gray-700 dark:text-gray-300 text-left block">
              Description:
            </label>
          </div>

          {/* Line 6/7: Description Field */}
          <div>
            <textarea
              id="description"
              name="description"
              value={formData.description || ''}
              onChange={handleInputChange}
              rows={4}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
            />
          </div>
        </form>
      </div>
    </div>
  );
}

