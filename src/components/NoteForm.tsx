import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import type { NoteFormData, NoteAttachment } from '../types/note';
import { noteService } from '../services/noteService';
import { accountService } from '../services/accountService';
import { contactService } from '../services/contactService';
import { opportunityService } from '../services/opportunityService';
import type { Account } from '../types/account';
import type { Contact } from '../types/contact';
import type { Opportunity } from '../types/opportunity';
import { useAuth } from '../context/AuthContext';
import { RichTextEditor } from './RichTextEditor';

const initialFormData: NoteFormData = {
  content: '',
  accountId: '',
  contactId: '',
  opportunityId: '',
  isPrivate: false,
};

export function NoteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [formData, setFormData] = useState<NoteFormData>(initialFormData);
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
    loadContacts();
    loadOpportunities();
    if (id) {
      loadNote(id);
    }
  }, [id]);

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

  const loadNote = async (noteId: string) => {
    try {
      setLoading(true);
      const note = await noteService.getById(noteId);
      if (note) {
        setFormData({
          content: note.content,
          accountId: note.accountId || '',
          contactId: note.contactId || '',
          opportunityId: note.opportunityId || '',
          isPrivate: note.isPrivate || false,
        });
        setAttachments(note.attachments || []);
      }
    } catch (err) {
      setError('Failed to load note');
      console.error('Error loading note:', err);
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

    // Check if content has meaningful text (strip HTML tags for validation)
    const textContent = formData.content.replace(/<[^>]*>/g, '').trim();
    if (!textContent && attachments.length === 0) {
      setError('Note content or attachment is required');
      setLoading(false);
      return;
    }

    try {
      const submitData = {
        ...formData,
        attachments: attachments.length > 0 ? attachments : undefined,
        accountId: formData.accountId || undefined,
        contactId: formData.contactId || undefined,
        opportunityId: formData.opportunityId || undefined,
      };

      if (id) {
        await noteService.update(id, submitData);
      } else {
        await noteService.create(submitData, user.id);
      }
      
      // Navigate back to the return path if provided, otherwise to notes list
      const state = location.state as { returnPath?: string } | null;
      if (state?.returnPath) {
        navigate(state.returnPath);
      } else {
        navigate('/notes');
      }
    } catch (err) {
      setError('Failed to save note');
      console.error('Error saving note:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
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
        [name]: type === 'checkbox' ? checked : value 
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

  if (loading && id) {
    return <div className="p-4">Loading note data...</div>;
  }

  const getBackPath = (): string => {
    const state = location.state as { returnPath?: string } | null;
    if (state?.returnPath) {
      return state.returnPath;
    }
    return '/notes';
  };

  return (
    <div className="p-6">
      <div className="w-full bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(getBackPath())}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            ← Back
          </button>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {id ? 'Edit Note' : 'New Note'}
          </h2>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-lg text-error-700 text-sm dark:bg-error-900/20 dark:border-error-800 dark:text-error-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Content *
            </label>
            <RichTextEditor
              value={formData.content}
              onChange={(value) => setFormData({ ...formData, content: value })}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              placeholder="Enter your note here... You can format text, add links, images, and attach files."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="accountId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Account
              </label>
              <select
                id="accountId"
                name="accountId"
                value={formData.accountId}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
              >
                <option value="">None</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="contactId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Contact
              </label>
              <select
                id="contactId"
                name="contactId"
                value={formData.contactId}
                onChange={handleInputChange}
                disabled={!formData.accountId}
                className="mt-1 block w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500 dark:disabled:text-gray-400"
              >
                <option value="">None</option>
                {filteredContacts.map(contact => (
                  <option key={contact.id} value={contact.id}>
                    {contact.firstName} {contact.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="opportunityId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Opportunity
              </label>
              <select
                id="opportunityId"
                name="opportunityId"
                value={formData.opportunityId}
                onChange={handleInputChange}
                disabled={!formData.accountId}
                className="mt-1 block w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500 dark:disabled:text-gray-400"
              >
                <option value="">None</option>
                {filteredOpportunities.map(opportunity => (
                  <option key={opportunity.id} value={opportunity.id}>{opportunity.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                name="isPrivate"
                checked={formData.isPrivate}
                onChange={handleInputChange}
                className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Private Note (only visible to you)</span>
            </label>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate(getBackPath())}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

