import type { Lead } from '../types';

export default function LeadTable({ leads, onSelectLead }: { leads: Lead[]; onSelectLead: (l: Lead) => void }) {
  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">Name</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">Company</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">Owner</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">Last Contact</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <tr key={lead.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5">
              <td className="px-4 py-3 text-sm">
                <button 
                  onClick={() => onSelectLead(lead)} 
                  className="text-brand-500 hover:text-brand-600 hover:underline font-medium dark:text-brand-400"
                >
                  {lead.name}
                </button>
              </td>
              <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{lead.company || '-'}</td>
              <td className="px-4 py-3 text-sm">
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300">
                  {lead.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{lead.owner || '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {formatDate(lead.createdAt)}
              </td>
              <td className="px-4 py-3 text-sm">
                <button className="text-brand-500 hover:text-brand-600 hover:underline dark:text-brand-400">Edit</button>
              </td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                No leads found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
