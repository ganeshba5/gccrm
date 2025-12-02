import { useState, useEffect } from 'react';
import type { Task } from '../types/task';
import type { Account } from '../types/account';
import type { Contact } from '../types/contact';
import type { Opportunity } from '../types/opportunity';
import type { User } from '../types/user';
import { taskService } from '../services/taskService';
import { accountService } from '../services/accountService';
import { contactService } from '../services/contactService';
import { opportunityService } from '../services/opportunityService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { canAccessAllData } from '../lib/auth-helpers';
import DatePicker from './DatePicker';

export default function ViewTaskModal({
  open,
  onClose,
  task,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  onUpdate: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Task['status']>('not_started');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [dueDate, setDueDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [contactId, setContactId] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [assignedUserName, setAssignedUserName] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setStatus(task.status || 'not_started');
      setPriority(task.priority || 'medium');
      setDueDate(task.dueDate ? task.dueDate.toISOString().split('T')[0] : '');
      setAccountId(task.accountId || '');
      setContactId(task.contactId || '');
      setOpportunityId(task.opportunityId || '');
      setAssignedTo(task.assignedTo || '');

      // Load assigned user name
      if (task.assignedTo) {
        userService.getById(task.assignedTo)
          .then(assignedUser => {
            if (assignedUser) {
              const name = assignedUser.displayName ||
                (assignedUser.firstName && assignedUser.lastName ? `${assignedUser.firstName} ${assignedUser.lastName}` : '') ||
                assignedUser.email ||
                task.assignedTo;
              setAssignedUserName(name || null);
            }
          })
          .catch(() => {});
      }
    }

    // Check admin status and load users if admin
    const checkAdmin = async () => {
      try {
        const admin = await canAccessAllData();
        setIsAdmin(admin);
        if (admin) {
          const usersData = await userService.getAll();
          setUsers(usersData);
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
      }
    };
    checkAdmin();

    // Load accounts, contacts, opportunities for dropdowns
    loadAccounts();
    if (task?.accountId) {
      loadContacts(task.accountId);
      loadOpportunities(task.accountId);
    }
  }, [task]);

  const loadAccounts = async () => {
    try {
      const data = await accountService.getAll();
      setAccounts(data);
    } catch (err) {
      console.error('Error loading accounts:', err);
    }
  };

  const loadContacts = async (accountId: string) => {
    try {
      const data = await contactService.getByAccount(accountId);
      setContacts(data);
    } catch (err) {
      console.error('Error loading contacts:', err);
    }
  };

  const loadOpportunities = async (accountId: string) => {
    try {
      const data = await opportunityService.getByAccount(accountId);
      setOpportunities(data);
    } catch (err) {
      console.error('Error loading opportunities:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !user) return;

    setError(null);
    setLoading(true);

    try {
      await taskService.update(task.id, {
        title: title.trim(),
        description: description || undefined,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        accountId: accountId || undefined,
        contactId: contactId || undefined,
        opportunityId: opportunityId || undefined,
        assignedTo: assignedTo || undefined,
      });
      onUpdate();
      onClose();
    } catch (err) {
      setError('Failed to update task');
      console.error('Error updating task:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccountChange = (value: string) => {
    setAccountId(value);
    setContactId('');
    setOpportunityId('');
    if (value) {
      loadContacts(value);
      loadOpportunities(value);
    } else {
      setContacts([]);
      setOpportunities([]);
    }
  };

  // Filter contacts and opportunities based on selected account
  const filteredContacts = accountId
    ? contacts.filter(contact => contact.accountId === accountId)
    : [];
  
  const filteredOpportunities = accountId
    ? opportunities.filter(opportunity => opportunity.accountId === accountId)
    : [];


  if (!open || !task) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-start z-50 overflow-y-auto pt-24 px-4">
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-theme-lg w-full max-w-2xl mb-8 px-4 sm:px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white text-left">Edit Task</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
              title="Cancel"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 6L14 14M6 14L14 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="submit"
              form="view-task-form"
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

        <form id="view-task-form" onSubmit={handleSubmit} className="space-y-3">
          {/* Line 1: Title */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
              Title:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
              disabled={loading}
            />
          </div>

          {/* Line 2: Status, Priority, Due Date */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
                Status:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Task['status'])}
                required
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                disabled={loading}
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
                Priority:
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Task['priority'])}
                required
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                disabled={loading}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
                Due Date:
              </label>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="Select due date"
                disabled={loading}
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
              />
            </div>
          </div>

          {/* Line 3: Contact, Opportunity, Assigned To */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
                Contact:
              </label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                disabled={!accountId || loading}
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
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
                Opportunity:
              </label>
              <select
                value={opportunityId}
                onChange={(e) => setOpportunityId(e.target.value)}
                disabled={!accountId || loading}
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500 dark:disabled:text-gray-400"
              >
                <option value="">None</option>
                {filteredOpportunities.map(opportunity => (
                  <option key={opportunity.id} value={opportunity.id}>{opportunity.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
                Assigned To:
              </label>
              {isAdmin ? (
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
                  disabled={loading}
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
                  value={assignedUserName || assignedTo || ''}
                  disabled
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
              )}
            </div>
          </div>

          {/* Line 4: Account */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-left">
              Account:
            </label>
            <select
              value={accountId}
              onChange={(e) => handleAccountChange(e.target.value)}
              className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
              disabled={loading}
            >
              <option value="">None</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>

          {/* Line 5: Description Label (left aligned) */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 text-left block">
              Description:
            </label>
          </div>

          {/* Line 6/7: Description Field */}
          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10"
              disabled={loading}
            />
          </div>
        </form>
      </div>
    </div>
  );
}

