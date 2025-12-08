import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { taskService } from '../services/taskService';
import { useAuth } from '../context/AuthContext';
import type { Task } from '../types/task';
import { userService } from '../services/userService';
import type { User } from '../types/user';
import DatePicker from './DatePicker';

type EntityType = 'opportunity' | 'account' | 'contact';

// Wrapper components for each entity type
export function OpportunityTasksPage() {
  const { id } = useParams<{ id: string }>();
  return <EntityTasksPage entityType="opportunity" entityId={id || ''} />;
}

export function AccountTasksPage() {
  const { id } = useParams<{ id: string }>();
  return <EntityTasksPage entityType="account" entityId={id || ''} />;
}

export function ContactTasksPage() {
  const { id } = useParams<{ id: string }>();
  return <EntityTasksPage entityType="contact" entityId={id || ''} />;
}

function EntityTasksPage({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status: 'not_started' as Task['status'],
    priority: 'medium' as Task['priority'],
    dueDate: '',
    assignedTo: '',
  });
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (entityId && entityType) {
      loadTasks();
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

  const loadTasks = async () => {
    if (!entityId || !entityType) return;
    
    try {
      setLoading(true);
      let fetchedTasks: Task[] = [];
      
      if (entityType === 'opportunity') {
        fetchedTasks = await taskService.getByOpportunity(entityId);
      } else if (entityType === 'account') {
        fetchedTasks = await taskService.getByAccount(entityId);
      } else if (entityType === 'contact') {
        fetchedTasks = await taskService.getByContact(entityId);
      }
      
      // Filter tasks: show tasks created by current user or assigned to current user
      if (user) {
        const filteredTasks = fetchedTasks.filter(task => 
          task.createdBy === user.id || task.assignedTo === user.id
        );
        setTasks(filteredTasks);
      } else {
        setTasks(fetchedTasks);
      }
      
      setError(null);
    } catch (err) {
      setError('Failed to load tasks');
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !entityId || !entityType || !newTask.title.trim()) return;

    try {
      setError(null);
      const taskData: any = {
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        status: newTask.status,
        priority: newTask.priority,
        dueDate: newTask.dueDate ? new Date(newTask.dueDate) : undefined,
        assignedTo: newTask.assignedTo || undefined,
      };

      if (entityType === 'opportunity') {
        taskData.opportunityId = entityId;
      } else if (entityType === 'account') {
        taskData.accountId = entityId;
      } else if (entityType === 'contact') {
        taskData.contactId = entityId;
      }

      await taskService.create(taskData, user.id);
      setNewTask({
        title: '',
        description: '',
        status: 'not_started',
        priority: 'medium',
        dueDate: '',
        assignedTo: '',
      });
      setIsCreating(false);
      await loadTasks();
    } catch (err) {
      setError('Failed to create task');
      console.error('Error creating task:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      await taskService.delete(taskId);
      await loadTasks();
    } catch (err) {
      setError('Failed to delete task');
      console.error('Error deleting task:', err);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      await taskService.update(taskId, { status: newStatus });
      await loadTasks();
    } catch (err) {
      setError('Failed to update task');
      console.error('Error updating task:', err);
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

  const getStatusColor = (status: Task['status']): string => {
    switch (status) {
      case 'completed':
        return 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-400';
      case 'in_progress':
        return 'bg-brand-100 text-brand-800 dark:bg-brand-900/20 dark:text-brand-400';
      case 'cancelled':
        return 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getPriorityColor = (priority: Task['priority']): string => {
    switch (priority) {
      case 'high':
        return 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-400';
      case 'medium':
        return 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const truncateContent = (content: string, maxLength: number = 100): string => {
    if (!content || content.length <= maxLength) return content || '-';
    return content.substring(0, maxLength) + '...';
  };

  if (loading) {
    return <div className="p-4">Loading tasks...</div>;
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
          <span className="text-4xl">✅</span>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{getEntityName()} Tasks</h1>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-lg shadow-theme-sm transition-colors font-medium text-sm"
          >
            + New Task
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
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Create New Task</h2>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                required
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={3}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={newTask.status}
                  onChange={(e) => setNewTask({ ...newTask, status: e.target.value as Task['status'] })}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority
                </label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Due Date
                </label>
                <DatePicker
                  value={newTask.dueDate}
                  onChange={(value) => setNewTask({ ...newTask, dueDate: value })}
                  placeholder="Select due date"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assign To
                </label>
                <select
                  value={newTask.assignedTo}
                  onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
                >
                  <option value="">Unassigned</option>
                  {Array.from(users.values()).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.displayName || (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : '') || u.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewTask({
                    title: '',
                    description: '',
                    status: 'not_started',
                    priority: 'medium',
                    dueDate: '',
                    assignedTo: '',
                  });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600"
              >
                Create Task
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No tasks found. {!isCreating && <button onClick={() => setIsCreating(true)} className="text-brand-500 hover:underline">Create one</button>}
          </div>
        ) : (
          <>
            {/* Grid Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              <div className="col-span-2">Title</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Priority</div>
              <div className="col-span-2">Assigned To</div>
              <div className="col-span-1">Due Date</div>
              <div className="col-span-1">Created</div>
              <div className="col-span-1">Actions</div>
            </div>
            {/* Grid Rows */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {tasks.map((task) => {
                const isExpanded = expandedTasks.has(task.id);
                const descriptionIsLong = task.description && task.description.length > 100;
                const displayDescription = isExpanded || !descriptionIsLong 
                  ? (task.description || '-')
                  : truncateContent(task.description || '', 100);
                
                return (
                  <div key={task.id} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="col-span-2 flex items-center">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {task.title}
                      </span>
                    </div>
                    <div className="col-span-3 flex items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                          {displayDescription}
                        </p>
                        {descriptionIsLong && (
                          <button
                            onClick={() => toggleTaskExpansion(task.id)}
                            className="mt-1 text-xs text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1"
                          >
                            {isExpanded ? (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                                Show less
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                                Show more
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="col-span-1 flex items-center">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(task.status)}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {task.assignedTo ? getUserName(task.assignedTo) : 'Unassigned'}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(task.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-2">
                      {user && (task.createdBy === user.id || task.assignedTo === user.id) && (
                        <>
                          <select
                            value={task.status}
                            onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as Task['status'])}
                            className="text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                          >
                            <option value="not_started">Not Started</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          {task.createdBy === user.id && (
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1.5 text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10 rounded transition-colors"
                              title="Delete"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

