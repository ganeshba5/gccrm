import type { NoteAttachment } from '../types/note';

interface NoteContentProps {
  content: string;
  attachments?: NoteAttachment[];
  maxLength?: number;
  showFull?: boolean;
  onToggleExpand?: () => void;
  viewOnly?: boolean; // If true, strip HTML and display as plain text with standard field styling
}

export function NoteContent({
  content,
  attachments = [],
  maxLength = 100,
  showFull = false,
  onToggleExpand,
  viewOnly = false,
}: NoteContentProps) {
  // Helper functions
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

  // Strip HTML tags to get plain text
  const textContent = content.replace(/<[^>]*>/g, '');
  const isLong = textContent.length > maxLength;
  
  // In view-only mode, always strip HTML and show plain text with same font as other fields
  if (viewOnly) {
    const displayText = showFull || !isLong 
      ? textContent 
      : textContent.substring(0, maxLength) + '...';
    
    return (
      <div className="note-content">
        <span className="text-xs text-gray-700 dark:text-gray-300 text-left block">
          {displayText}
        </span>
        
        {isLong && onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className="ml-1 text-xs text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            {showFull ? 'Show less' : 'Show more'}
          </button>
        )}

        {attachments.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Attachments ({attachments.length})
            </div>
            <div className="space-y-1">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                >
                  <span className="text-sm">{getFileIcon(attachment.type)}</span>
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex-1 truncate"
                  >
                    {attachment.name}
                  </a>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(attachment.size)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Normal mode: render HTML
  const displayContent = showFull || !isLong ? content : truncateHtml(content, maxLength);

  return (
    <div className="note-content">
      <div
        className="prose prose-sm dark:prose-invert max-w-none text-xs text-left"
        dangerouslySetInnerHTML={{ __html: displayContent }}
        style={{
          wordBreak: 'break-word',
          fontSize: '0.75rem', // Force text-xs size (12px)
          lineHeight: '1rem',
          textAlign: 'left',
        }}
      />
      
      {isLong && onToggleExpand && (
        <button
          onClick={onToggleExpand}
          className="mt-1 text-xs text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
        >
          {showFull ? 'Show less' : 'Show more'}
        </button>
      )}

      {attachments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            Attachments ({attachments.length})
          </div>
          <div className="space-y-1">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
              >
                <span className="text-sm">{getFileIcon(attachment.type)}</span>
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex-1 truncate"
                >
                  {attachment.name}
                </a>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(attachment.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .note-content .prose {
          color: inherit;
          font-size: 0.75rem !important; /* text-xs */
          line-height: 1rem !important;
        }
        .note-content .prose p {
          margin-top: 0.25em;
          margin-bottom: 0.25em;
          font-size: 0.75rem !important;
          line-height: 1rem !important;
        }
        .note-content .prose ul,
        .note-content .prose ol {
          margin-top: 0.25em;
          margin-bottom: 0.25em;
          font-size: 0.75rem !important;
        }
        .note-content .prose li {
          font-size: 0.75rem !important;
          line-height: 1rem !important;
        }
        .note-content .prose h1,
        .note-content .prose h2,
        .note-content .prose h3,
        .note-content .prose h4,
        .note-content .prose h5,
        .note-content .prose h6 {
          font-size: 0.75rem !important;
          line-height: 1rem !important;
        }
        .note-content .prose strong,
        .note-content .prose b {
          font-size: 0.75rem !important;
        }
        .note-content .prose img {
          max-width: 100%;
          height: auto;
        }
        .note-content .prose a {
          color: #465fff;
          text-decoration: underline;
          font-size: 0.75rem !important;
        }
        .dark .note-content .prose a {
          color: #7c8fff;
        }
      `}</style>
    </div>
  );
}

// Helper function to truncate HTML while preserving tags
function truncateHtml(html: string, maxLength: number): string {
  const textContent = html.replace(/<[^>]*>/g, '');
  if (textContent.length <= maxLength) return html;

  // Simple truncation - in a production app, you'd want more sophisticated HTML truncation
  let truncated = '';
  let textLength = 0;
  let inTag = false;
  let tagBuffer = '';

  for (let i = 0; i < html.length; i++) {
    const char = html[i];
    
    if (char === '<') {
      inTag = true;
      tagBuffer = char;
    } else if (char === '>') {
      inTag = false;
      tagBuffer += char;
      truncated += tagBuffer;
      tagBuffer = '';
    } else if (inTag) {
      tagBuffer += char;
    } else {
      if (textLength < maxLength) {
        truncated += char;
        textLength++;
      } else {
        break;
      }
    }
  }

  return truncated + '...';
}

