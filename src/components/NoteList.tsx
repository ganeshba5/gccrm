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

export function NoteList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterId, setFilterId] = useState<string>('');

  useEffect(() => {
    loadAccounts();
    loadContacts();
    loadOpportunities();
    loadNotes();
  }, []);

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
      const filtered = data.filter(note => !note.isPrivate || note.createdBy === user?.uid);
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
      const filtered = data.filter(note => !note.isPrivate || note.createdBy === user?.uid);
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

  if (loading) {
    return <div className="p-4">Loading notes...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <span className="text-4xl">📝</span>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notes</h1>
        </div>
        <button
          className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-lg shadow-theme-sm transition-colors font-medium text-sm"
          onClick={() => navigate('/notes/new')}
        >
          + New Note
        </button>
      </div>

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

      <div className="space-y-4">
        {notes.map((note) => (
          <div key={note.id} className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {getEntityName(note)}
                </span>
                {note.isPrivate && (
                  <span className="ml-2 text-xs text-warning-500 dark:text-warning-400">Private</span>
                )}
              </div>
              <div className="flex gap-2">
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
                        loadNotes();
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
            <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap mb-2">
              {note.content}
            </p>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(note.createdAt)}
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg">
            No notes found
          </div>
        )}
      </div>
    </div>
  );
}

