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

      {/* Desktop Grid View */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          {emails.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No emails found
            </div>
          ) : (
            <>
              {/* Grid Header */}
              <div className="grid grid-cols-12 gap-4 px-4 xl:px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                <div className="col-span-2">From</div>
                <div className="col-span-1">To</div>
                <div className="col-span-4 text-left">Subject</div>
                <div className="col-span-2 text-left">Snippet</div>
                <div className="col-span-2">Received</div>
                <div className="col-span-1">Actions</div>
              </div>
              {/* Grid Rows */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {emails.map((email) => (
                  <div 
                    key={email.id} 
                    className="grid grid-cols-12 gap-4 px-4 xl:px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors items-center"
                  >
                    <div className="col-span-2 max-w-[200px]">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 dark:text-white break-words">
                          {email.from.name || email.from.email}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 break-words">
                          {email.from.email}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {email.to.length}
                      </span>
                    </div>
                    <div className="col-span-4 max-w-[400px]">
                      <span className="text-sm font-medium text-gray-900 dark:text-white break-words block">
                        {email.subject || '(No Subject)'}
                      </span>
                    </div>
                    <div className="col-span-2 max-w-[250px]">
                      <span className="text-sm text-gray-700 dark:text-gray-300 text-left break-words block">
                        {getSnippet(email)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(email.receivedAt)}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
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
              ))}
            </div>
          </>
        )}
        </div>
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

