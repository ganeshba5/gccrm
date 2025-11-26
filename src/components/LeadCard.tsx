import type { Lead } from '../types';

export default function LeadCard({ lead, onClick }: { lead: Lead; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="p-3 border rounded-md bg-white shadow-sm cursor-pointer">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-900">{lead.name}</div>
          <div className="text-xs text-gray-500">{lead.company}</div>
        </div>
        <div className="text-sm text-gray-600">{lead.status}</div>
      </div>
      <div className="mt-2 text-sm text-gray-600">{lead.email} • {lead.phone}</div>
    </div>
  );
}
