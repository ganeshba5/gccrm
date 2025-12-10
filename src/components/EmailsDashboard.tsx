import { useState, useEffect } from 'react';
import { inboundEmailService } from '../services/inboundEmailService';
import type { InboundEmail } from '../types/inboundEmail';
import EmailDetailModal from './EmailDetailModal';

export default function EmailsDashboard() {
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    try {
      setLoading(true);
      const data = await inboundEmailService.getAll();
      setEmails(data);
      setError(null);
    } catch (err) {
      setError('Failed to load emails');
      console.error('Error loading emails:', err);
    } finally {
      setLoading(false);
    }
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

  const handleViewEmail = (email: InboundEmail) => {
    setSelectedEmail(email);
    setIsDetailModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsDetailModalOpen(false);
    setSelectedEmail(null);
  };

  const handleFetchEmails = async () => {
    try {
      setIsFetching(true);
      setFetchMessage(null);
      setError(null);

      // Get the Firebase project ID from environment or use default
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gccrmapp';
      const functionUrl = `https://us-central1-${projectId}.cloudfunctions.net/fetchEmails`;

      console.log('Calling fetchEmails function:', functionUrl);

      const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch emails: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('fetchEmails result:', result);

      // Show success message
      setFetchMessage(`Successfully fetched emails! Stored: ${result.stored || 0}, Skipped: ${result.skipped || 0}`);
      
      // Reload emails after a short delay to allow processing
      setTimeout(() => {
        loadEmails();
      }, 2000);
    } catch (err: any) {
      console.error('Error calling fetchEmails:', err);
      setError(`Failed to fetch emails: ${err.message || 'Unknown error'}`);
      setFetchMessage(null);
    } finally {
      setIsFetching(false);
    }
  };

  // Strip HTML tags for snippet display
  const stripHtmlTags = (html: string | undefined): string => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  };

  const getSnippet = (email: InboundEmail): string => {
    if (email.snippet) return email.snippet;
    if (email.body.text) {
      const text = email.body.text.substring(0, 100);
      return text.length < email.body.text.length ? text + '...' : text;
    }
    if (email.body.html) {
      const text = stripHtmlTags(email.body.html).substring(0, 100);
      return text.length < stripHtmlTags(email.body.html).length ? text + '...' : text;
    }
    return 'No content';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-6">
      {/* Fetch Emails Button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleFetchEmails}
            disabled={isFetching}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium shadow-theme-sm transition-colors flex items-center gap-2"
          >
            {isFetching ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Fetching...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Fetch Emails</span>
              </>
            )}
          </button>
          {fetchMessage && (
            <div className="text-sm text-success-600 dark:text-success-400">
              {fetchMessage}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 text-error-600 dark:text-error-400">
          {error}
          <button 
            onClick={loadEmails}
            className="ml-4 text-brand-500 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Mobile/Tablet Card View */}
      <div className="lg:hidden space-y-4">
        {emails.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No emails found
          </div>
        ) : (
          emails.map((email) => (
            <div 
              key={email.id} 
              className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white break-words">
                    {email.from.name || email.from.email}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 break-words mt-1">
                    {email.from.email}
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  {email.to.length} recipient{email.to.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-white break-words">
                {email.subject || '(No Subject)'}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 break-words">
                {getSnippet(email)}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(email.receivedAt)}
                </span>
                <button
                  className="p-1.5 text-brand-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded transition-colors"
                  onClick={() => handleViewEmail(email)}
                  title="View Email"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Free-Form List View */}
      <div className="hidden lg:block space-y-4">
        {emails.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 shadow-md rounded-lg">
            No emails found
          </div>
        ) : (
          emails.map((email) => (
            <div 
              key={email.id} 
              className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 space-y-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold text-gray-900 dark:text-white break-words mb-1">
                        {email.from.name || email.from.email}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 break-words">
                        {email.from.email}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="whitespace-nowrap">
                        {email.to.length} recipient{email.to.length !== 1 ? 's' : ''}
                      </span>
                      <span className="whitespace-nowrap">
                        {formatDate(email.receivedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="text-lg font-semibold text-gray-900 dark:text-white break-words mb-3">
                  {email.subject || '(No Subject)'}
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300 break-words leading-relaxed">
                  {getSnippet(email)}
                </div>
              </div>
              
              <div className="flex items-center justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  className="px-4 py-2 text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors flex items-center gap-2"
                  onClick={() => handleViewEmail(email)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View Email
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Email Detail Modal */}
      {selectedEmail && (
        <EmailDetailModal
          email={selectedEmail}
          isOpen={isDetailModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

