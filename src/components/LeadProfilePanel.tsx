import type { Lead } from '../types';

export default function LeadProfilePanel({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  if (!lead) return null;

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-medium">{lead.name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">Close</button>
        </div>
        <div className="p-4">
          <div className="text-sm text-gray-600">Company: {lead.company}</div>
          <div className="text-sm text-gray-600">Email: {lead.email}</div>
          <div className="text-sm text-gray-600">Phone: {lead.phone}</div>
          <div className="text-sm text-gray-600">Status: {lead.status}</div>
        </div>
      </div>
    </div>
  );
}
