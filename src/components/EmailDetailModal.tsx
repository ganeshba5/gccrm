import type { InboundEmail } from '../types/inboundEmail';

interface EmailDetailModalProps {
  email: InboundEmail;
  isOpen: boolean;
  onClose: () => void;
}

export default function EmailDetailModal({ email, isOpen, onClose }: EmailDetailModalProps) {
  if (!isOpen) return null;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatEmailList = (emails: string[] | undefined): string => {
    if (!emails || emails.length === 0) return '-';
    return emails.join(', ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-left">
            Email Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">
              From
            </label>
            <div className="text-sm text-gray-900 dark:text-white text-left">
              {email.from.name && (
                <div className="font-medium">{email.from.name}</div>
              )}
              <div className="text-gray-600 dark:text-gray-400">{email.from.email}</div>
            </div>
          </div>

          {/* To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">
              To
            </label>
            <div className="text-sm text-gray-900 dark:text-white text-left">
              {formatEmailList(email.to)}
            </div>
          </div>

          {/* CC */}
          {email.cc && email.cc.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">
                CC
              </label>
              <div className="text-sm text-gray-900 dark:text-white text-left">
                {formatEmailList(email.cc)}
              </div>
            </div>
          )}

          {/* BCC */}
          {email.bcc && email.bcc.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">
                BCC
              </label>
              <div className="text-sm text-gray-900 dark:text-white text-left">
                {formatEmailList(email.bcc)}
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">
              Subject
            </label>
            <div className="text-sm text-gray-900 dark:text-white text-left">
              {email.subject || '(No Subject)'}
            </div>
          </div>

          {/* Received Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">
              Received
            </label>
            <div className="text-sm text-gray-900 dark:text-white text-left">
              {formatDate(email.receivedAt)}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">
              Status
            </label>
            <div className="flex items-center gap-2 text-left">
              {email.read ? (
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded">
                  Read
                </span>
              ) : (
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded">
                  Unread
                </span>
              )}
              {email.processed && (
                <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 rounded">
                  Processed
                </span>
              )}
            </div>
          </div>

          {/* Linked To */}
          {email.linkedTo && (email.linkedTo.accountId || email.linkedTo.contactId || email.linkedTo.opportunityId || email.linkedTo.noteId) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">
                Linked To
              </label>
              <div className="text-sm text-gray-900 dark:text-white space-y-1 text-left">
                {email.linkedTo.accountId && (
                  <div>Account: {email.linkedTo.accountId}</div>
                )}
                {email.linkedTo.contactId && (
                  <div>Contact: {email.linkedTo.contactId}</div>
                )}
                {email.linkedTo.opportunityId && (
                  <div>Opportunity: {email.linkedTo.opportunityId}</div>
                )}
                {email.linkedTo.noteId && (
                  <div>Note: {email.linkedTo.noteId}</div>
                )}
              </div>
            </div>
          )}

          {/* Labels */}
          {email.labels && email.labels.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">
                Labels
              </label>
              <div className="flex flex-wrap gap-2 text-left">
                {email.labels.map((label, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">
                Attachments ({email.attachments.length})
              </label>
              <div className="space-y-2 text-left">
                {email.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
                  >
                    <span className="text-sm">📎</span>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {attachment.filename}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {attachment.mimeType} • {(attachment.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    {attachment.url && (
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Body - HTML */}
          {email.body.html && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">
                Content (HTML)
              </label>
              <div
                className="text-sm text-gray-900 dark:text-white prose prose-sm dark:prose-invert max-w-none border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 text-left"
                dangerouslySetInnerHTML={{ __html: email.body.html }}
              />
            </div>
          )}

          {/* Body - Text (if no HTML) */}
          {!email.body.html && email.body.text && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">
                Content
              </label>
              <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 text-left">
                {email.body.text}
              </div>
            </div>
          )}

          {/* No Content */}
          {!email.body.html && !email.body.text && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">
                Content
              </label>
              <div className="text-sm text-gray-500 dark:text-gray-400 italic text-left">
                No content available
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

