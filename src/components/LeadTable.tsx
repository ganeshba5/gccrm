import type { Lead } from '../types';

export default function LeadTable({ leads, onSelectLead }: { leads: Lead[]; onSelectLead: (l: Lead) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Name</th>
            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Company</th>
            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Status</th>
            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Owner</th>
            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Last Contact</th>
            <th className="px-3 py-2 text-right text-sm font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {leads.map(lead => (
            <tr key={lead.id} className="hover:bg-gray-50">
              <td className="px-3 py-3 text-sm text-gray-900">
                <button onClick={() => onSelectLead(lead)} className="text-left text-indigo-600 hover:underline">
                  {lead.name}
                </button>
              </td>
              <td className="px-3 py-3 text-sm text-gray-700">{lead.company}</td>
              <td className="px-3 py-3 text-sm">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{lead.status}</span>
              </td>
              <td className="px-3 py-3 text-sm text-gray-700">{lead.owner}</td>
              <td className="px-3 py-3 text-sm text-gray-500">
                {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '-'}
              </td>
              <td className="px-3 py-3 text-sm text-right">
                <button className="text-sm text-indigo-600 hover:underline">Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
