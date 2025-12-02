import type { NoteAttachment } from '../types/note';

interface NoteContentProps {
  content: string;
  attachments?: NoteAttachment[];
  maxLength?: number;
  showFull?: boolean;
  onToggleExpand?: () => void;
}

export function NoteContent({
  content,
  attachments = [],
  maxLength = 100,
  showFull = false,
  onToggleExpand,
}: NoteContentProps) {
  // Strip HTML tags to get plain text for length check
  const textContent = content.replace(/<[^>]*>/g, '');
  const isLong = textContent.length > maxLength;
  const displayContent = showFull || !isLong ? content : truncateHtml(content, maxLength);

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
    <div className="note-content">
      <div
        className="prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: displayContent }}
        style={{
          wordBreak: 'break-word',
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
        }
        .note-content .prose p {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }
        .note-content .prose ul,
        .note-content .prose ol {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }
        .note-content .prose img {
          max-width: 100%;
          height: auto;
        }
        .note-content .prose a {
          color: #465fff;
          text-decoration: underline;
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

