import { useState, useRef, useEffect } from 'react';
import DatePicker from './DatePicker';

interface NestedDateFilterProps {
  dateFilterType: string;
  dateFilterValue: string;
  onTypeChange: (type: string) => void;
  onValueChange: (value: string) => void;
  getYearOptions: () => string[];
  getQuarterOptions: () => string[];
  getMonthOptions: () => string[];
  customStartDate: string;
  customEndDate: string;
  onCustomStartDateChange: (value: string) => void;
  onCustomEndDateChange: (value: string) => void;
}

export default function NestedDateFilter({
  dateFilterType,
  dateFilterValue,
  onTypeChange,
  onValueChange,
  getYearOptions,
  getQuarterOptions,
  getMonthOptions,
  customStartDate,
  customEndDate,
  onCustomStartDateChange,
  onCustomEndDateChange,
}: NestedDateFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const getDisplayText = () => {
    if (dateFilterType === 'all') return 'All Dates';
    if (dateFilterType === 'custom') return 'Custom Range';
    if (dateFilterType === 'year' && dateFilterValue) {
      return dateFilterValue;
    }
    if (dateFilterType === 'quarter' && dateFilterValue) {
      const [year, quarter] = dateFilterValue.split('-');
      return `Q${quarter} ${year}`;
    }
    if (dateFilterType === 'month' && dateFilterValue) {
      const [year, month] = dateFilterValue.split('-');
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    return 'Select Date Filter';
  };

  const handleSelect = (type: string, value?: string) => {
    onTypeChange(type);
    if (value) {
      onValueChange(value);
    } else {
      onValueChange('');
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 min-w-[180px] text-left flex items-center justify-between"
      >
        <span>{getDisplayText()}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          <button
            type="button"
            onClick={() => handleSelect('all')}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
              dateFilterType === 'all' ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400' : 'text-gray-700 dark:text-gray-200'
            }`}
          >
            All Dates
          </button>

          {/* Years Section */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('year')}
              className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between"
            >
              <span>By Year</span>
              <svg
                className={`w-4 h-4 transition-transform ${expandedSections.has('year') ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {expandedSections.has('year') && (
              <div className="pl-4">
                {getYearOptions().map(option => {
                  const [value, label] = option.split('|');
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleSelect('year', value)}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        dateFilterType === 'year' && dateFilterValue === value
                          ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quarters Section */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('quarter')}
              className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between"
            >
              <span>By Quarter</span>
              <svg
                className={`w-4 h-4 transition-transform ${expandedSections.has('quarter') ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {expandedSections.has('quarter') && (
              <div className="pl-4">
                {getQuarterOptions().map(option => {
                  const [value, label] = option.split('|');
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleSelect('quarter', value)}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        dateFilterType === 'quarter' && dateFilterValue === value
                          ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Months Section */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('month')}
              className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between"
            >
              <span>By Month</span>
              <svg
                className={`w-4 h-4 transition-transform ${expandedSections.has('month') ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {expandedSections.has('month') && (
              <div className="pl-4">
                {getMonthOptions().map(option => {
                  const [value, label] = option.split('|');
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleSelect('month', value)}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        dateFilterType === 'month' && dateFilterValue === value
                          ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleSelect('custom')}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-200 dark:border-gray-700 ${
              dateFilterType === 'custom' ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400' : 'text-gray-700 dark:text-gray-200'
            }`}
          >
            Custom Range
          </button>
        </div>
      )}

      {dateFilterType === 'custom' && (
        <div className="flex items-center gap-2 mt-2">
          <DatePicker
            value={customStartDate}
            onChange={onCustomStartDateChange}
            placeholder="Start Date"
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
          />
          <span className="text-gray-500 dark:text-gray-400">to</span>
          <DatePicker
            value={customEndDate}
            onChange={onCustomEndDateChange}
            placeholder="End Date"
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm focus:outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700"
          />
        </div>
      )}
    </div>
  );
}

