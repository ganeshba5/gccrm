export default function LeadFilters() {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div>
        <select className="border rounded-md px-2 py-1">
          <option value="">All statuses</option>
          <option value="New">New</option>
          <option value="Contacted">Contacted</option>
          <option value="Qualified">Qualified</option>
          <option value="Converted">Converted</option>
        </select>
      </div>
      <div>
        <input className="border rounded-md px-2 py-1" placeholder="Owner" />
      </div>
      <div className="ml-auto text-sm text-gray-500">Filters are client-side placeholders</div>
    </div>
  );
}
