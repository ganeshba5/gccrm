export default function TasksPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Page Title */}
      <div className="flex items-center space-x-3 mb-6">
        <span className="text-4xl">✅</span>
        <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
      </div>

      {/* Filters and View Options */}
      <div className="bg-gray-50 p-4 rounded-lg mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <select className="px-4 py-2 border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option>All Tasks</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">0 results</span>
            <button className="p-2 hover:bg-gray-200 rounded">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">Task management coming soon...</p>
      </div>
    </div>
  );
}

