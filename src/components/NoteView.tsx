import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import type { Note } from '../types/note';
import type { User } from '../types/user';
import { noteService } from '../services/noteService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { RichTextEditor } from './RichTextEditor';

export function NoteView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [note, setNote] = useState<Note | null>(null);
  const [creator, setCreator] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editAttachments, setEditAttachments] = useState(note?.attachments || []);
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      loadNote(id);
    }
  }, [id]);

  const loadNote = async (noteId: string) => {
    try {
      setLoading(true);
      const loadedNote = await noteService.getById(noteId);
      if (loadedNote) {
        setNote(loadedNote);
        setEditContent(loadedNote.content);
        setEditAttachments(loadedNote.attachments || []);
        setEditIsPrivate(loadedNote.isPrivate || false);
        
        // Load creator info
        try {
          const creatorData = await userService.getById(loadedNote.createdBy);
          if (creatorData) {
            setCreator(creatorData);
          }
        } catch (err) {
          console.error('Error loading creator:', err);
        }
      } else {
        setError('Note not found');
      }
    } catch (err) {
      setError('Failed to load note');
      console.error('Error loading note:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!note || !user) return;

    try {
      setSaving(true);
      const textContent = editContent.replace(/<[^>]*>/g, '').trim();
      if (!textContent) {
        setError('Note content cannot be empty');
        return;
      }

      await noteService.update(note.id, {
        content: editContent,
        attachments: editAttachments,
        isPrivate: editIsPrivate,
      });

      setIsEditing(false);
      await loadNote(note.id);
    } catch (err) {
      setError('Failed to save note');
      console.error('Error saving note:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (note) {
      setEditContent(note.content);
      setEditAttachments(note.attachments || []);
      setEditIsPrivate(note.isPrivate || false);
    }
    setIsEditing(false);
    setError(null);
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCreatorName = (): string => {
    if (creator) {
      return creator.displayName || 
        (creator.firstName && creator.lastName ? `${creator.firstName} ${creator.lastName}` : '') ||
        creator.email;
    }
    return note?.createdBy || 'Unknown';
  };

  const getBackPath = (): string => {
    // First, check if we have a return path from navigation state
    const state = location.state as { returnPath?: string } | null;
    if (state?.returnPath) {
      return state.returnPath;
    }
    
    // Fallback to note associations if no return path provided
    if (!note) return '/dashboard';
    
    if (note.accountId) return `/accounts/${note.accountId}/edit`;
    if (note.opportunityId) return `/opportunities/${note.opportunityId}/edit`;
    if (note.contactId) return `/contacts/${note.contactId}/edit`;
    
    return '/dashboard';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="w-full bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading note...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !note) {
    return (
      <div className="p-6">
        <div className="w-full bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <div className="text-center py-12">
            <p className="text-error-600 dark:text-error-400">{error}</p>
            <button
              onClick={() => navigate(getBackPath())}
              className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!note) {
    return null;
  }

  return (
    <div className="p-6">
      <div className="w-full bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(getBackPath())}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            ← Back
          </button>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Note' : 'View Note'}
          </h2>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-lg text-error-700 text-sm dark:bg-error-900/20 dark:border-error-800 dark:text-error-400">
            {error}
          </div>
        )}

        {/* Note metadata */}
        <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Created by:</span>
              <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                {getCreatorName()}
              </span>
            </div>
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Created:</span>
              <span className="ml-2 text-sm text-gray-900 dark:text-white">
                {formatDate(note.createdAt)}
              </span>
            </div>
            {note.updatedAt && note.updatedAt.getTime() !== note.createdAt.getTime() && (
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Updated:</span>
                <span className="ml-2 text-sm text-gray-900 dark:text-white">
                  {formatDate(note.updatedAt)}
                </span>
              </div>
            )}
            {note.isPrivate && (
              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 rounded">
                Private
              </span>
            )}
            {note.source === 'email' && (
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Generated from Email
              </span>
            )}
          </div>
        </div>

        {/* Note content */}
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content *
              </label>
              <RichTextEditor
                value={editContent}
                onChange={setEditContent}
                attachments={editAttachments}
                onAttachmentsChange={setEditAttachments}
                placeholder="Enter your note here... You can format text, add links, images, and attach files."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPrivate"
                checked={editIsPrivate}
                onChange={(e) => setEditIsPrivate(e.target.checked)}
                className="h-4 w-4 text-brand-500 focus:ring-brand-500 border-gray-300 rounded"
              />
              <label htmlFor="isPrivate" className="text-sm text-gray-700 dark:text-gray-300">
                Private
              </label>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="prose dark:prose-invert max-w-none">
              <div
                className="note-content-full"
                dangerouslySetInnerHTML={{ __html: note.content }}
                style={{
                  wordBreak: 'break-word',
                }}
              />
            </div>
            
            {note.attachments && note.attachments.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Attachments ({note.attachments.length})
                </div>
                <div className="space-y-2">
                  {note.attachments.map((attachment) => {
                    const formatFileSize = (bytes: number): string => {
                      if (bytes < 1024) return bytes + ' B';
                      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
                      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
                    };
                    const getFileIcon = (type: string): string => {
                      if (type.startsWith('image/')) return '🖼️';
                      if (type.includes('pdf')) return '📄';
                      if (type.includes('word') || type.includes('document')) return '📝';
                      if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
                      if (type.includes('zip') || type.includes('archive')) return '📦';
                      return '📎';
                    };
                    return (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                      >
                        <span className="text-lg">{getFileIcon(attachment.type)}</span>
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-brand-600 dark:text-brand-400 hover:underline flex-1"
                        >
                          {attachment.name}
                        </a>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatFileSize(attachment.size)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {user && note.createdBy === user.id && note.source !== 'email' && (
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Edit
                </button>
              </div>
            )}
            {note.source === 'email' && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  This note was automatically generated from an email and cannot be edited.
                </p>
              </div>
            )}
          </div>
        )}

        <style>{`
          .note-content-full {
            color: inherit;
            font-size: 1rem;
            line-height: 1.6;
          }
          .note-content-full p {
            margin-top: 0.75em;
            margin-bottom: 0.75em;
          }
          .note-content-full ul,
          .note-content-full ol {
            margin-top: 0.75em;
            margin-bottom: 0.75em;
            padding-left: 1.5em;
          }
          .note-content-full li {
            margin-top: 0.25em;
            margin-bottom: 0.25em;
          }
          .note-content-full h1,
          .note-content-full h2,
          .note-content-full h3,
          .note-content-full h4,
          .note-content-full h5,
          .note-content-full h6 {
            margin-top: 1em;
            margin-bottom: 0.5em;
            font-weight: 600;
          }
          .note-content-full h1 { font-size: 1.875rem; }
          .note-content-full h2 { font-size: 1.5rem; }
          .note-content-full h3 { font-size: 1.25rem; }
          .note-content-full h4 { font-size: 1.125rem; }
          .note-content-full strong,
          .note-content-full b {
            font-weight: 600;
          }
          .note-content-full img {
            max-width: 100%;
            height: auto;
            border-radius: 0.375rem;
            margin: 1em 0;
          }
          .note-content-full a {
            color: #465fff;
            text-decoration: underline;
          }
          .dark .note-content-full a {
            color: #7c8fff;
          }
          .note-content-full blockquote {
            border-left: 4px solid #e5e7eb;
            padding-left: 1em;
            margin: 1em 0;
            font-style: italic;
          }
          .dark .note-content-full blockquote {
            border-left-color: #4b5563;
          }
          .note-content-full code {
            background-color: #f3f4f6;
            padding: 0.125em 0.375em;
            border-radius: 0.25rem;
            font-size: 0.875em;
          }
          .dark .note-content-full code {
            background-color: #374151;
          }
          .note-content-full pre {
            background-color: #f3f4f6;
            padding: 1em;
            border-radius: 0.375rem;
            overflow-x: auto;
            margin: 1em 0;
          }
          .dark .note-content-full pre {
            background-color: #374151;
          }
          .note-content-full table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
          }
          .note-content-full table th,
          .note-content-full table td {
            border: 1px solid #e5e7eb;
            padding: 0.5em;
            text-align: left;
          }
          .dark .note-content-full table th,
          .dark .note-content-full table td {
            border-color: #4b5563;
          }
          .note-content-full table th {
            background-color: #f9fafb;
            font-weight: 600;
          }
          .dark .note-content-full table th {
            background-color: #374151;
          }
        `}</style>
      </div>
    </div>
  );
}

