import React, { useState } from 'react';
import { X } from 'lucide-react';

export interface FilterSettings {
  startTime: string;
  endTime: string;
  regexInclude: string[];
  regexExclude: string[];
}

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filterSettings: FilterSettings;
  onFilterChange: (settings: FilterSettings) => void;
  availableThreadIds: string[];
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  isOpen,
  onClose,
  filterSettings,
  onFilterChange,
}) => {
  const [includeText, setIncludeText] = useState(() => 
    filterSettings.regexInclude?.join('\n') || ''
  );
  const [excludeText, setExcludeText] = useState(() => 
    filterSettings.regexExclude?.join('\n') || ''
  );

  if (!isOpen) return null;

  const handleIncludeChange = (text: string) => {
    setIncludeText(text);
    const patterns = text.split('\n').map(line => line.trim()).filter(line => line);
    onFilterChange({
      ...filterSettings,
      regexInclude: patterns
    });
  };

  const handleExcludeChange = (text: string) => {
    setExcludeText(text);
    const patterns = text.split('\n').map(line => line.trim()).filter(line => line);
    onFilterChange({
      ...filterSettings,
      regexExclude: patterns
    });
  };

  const clearAllFilters = () => {
    setIncludeText('');
    setExcludeText('');
    onFilterChange({
      startTime: '',
      endTime: '',
      regexInclude: [],
      regexExclude: []
    });
  };

  const hasActiveFilters = () => {
    return filterSettings.startTime || 
           filterSettings.endTime || 
           (filterSettings.regexInclude && filterSettings.regexInclude.length > 0) ||
           (filterSettings.regexExclude && filterSettings.regexExclude.length > 0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Data Filters</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-6 overflow-y-auto">
          
          {/* Time Range Filters */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Time Range</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={filterSettings.startTime}
                  onChange={(e) => onFilterChange({
                    ...filterSettings,
                    startTime: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-700 mb-1">End Time</label>
                <input
                  type="datetime-local"
                  value={filterSettings.endTime}
                  onChange={(e) => onFilterChange({
                    ...filterSettings,
                    endTime: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Regex Filters */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Pattern Matching</h3>
            
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Include Patterns
                <span className="text-gray-500 text-xs ml-1">(messages must match at least one pattern)</span>
              </label>
              <textarea
                value={includeText}
                onChange={(e) => handleIncludeChange(e.target.value)}
                placeholder="Enter regex patterns, one per line&#10;Example:&#10;error.*database&#10;^user.*login"
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
              />
              <p className="text-xs text-gray-500 mt-1">
                Regular expressions are case-insensitive. Empty lines are ignored.
              </p>
            </div>
            
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Exclude Patterns
                <span className="text-gray-500 text-xs ml-1">(messages matching any pattern are hidden)</span>
              </label>
              <textarea
                value={excludeText}
                onChange={(e) => handleExcludeChange(e.target.value)}
                placeholder="Enter regex patterns to exclude, one per line&#10;Example:&#10;debug.*noise&#10;heartbeat"
                className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
              />
              <p className="text-xs text-gray-500 mt-1">
                Exclude patterns take precedence after include patterns are applied.
              </p>
            </div>
          </div>

          {/* Filter Examples */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Pattern Examples</h4>
            <div className="text-xs text-blue-800 space-y-1 font-mono">
              <div><code>error</code> - Contains "error" anywhere</div>
              <div><code>^user</code> - Starts with "user"</div>
              <div><code>login$</code> - Ends with "login"</div>
              <div><code>user.*login</code> - Contains "user" followed by "login"</div>
              <div><code>\d+ms</code> - Contains numbers followed by "ms"</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4">
          <div className="flex justify-between">
            <button
              onClick={clearAllFilters}
              disabled={!hasActiveFilters()}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Clear All Filters
            </button>
            
            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;