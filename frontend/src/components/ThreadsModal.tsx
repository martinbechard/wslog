import React from 'react';
import { X, Check } from 'lucide-react';

interface ThreadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allThreadIds: string[];
  selectedThreads: Set<string>;
  onSelectedThreadsChange: (threads: Set<string>) => void;
  displayThreadId: boolean;
  onDisplayThreadIdChange: (display: boolean) => void;
}

const ThreadsModal: React.FC<ThreadsModalProps> = ({
  isOpen,
  onClose,
  allThreadIds,
  selectedThreads,
  onSelectedThreadsChange,
  displayThreadId,
  onDisplayThreadIdChange,
}) => {
  if (!isOpen) return null;

  const toggleThread = (threadId: string) => {
    const newSelected = new Set(selectedThreads);
    if (newSelected.has(threadId)) {
      newSelected.delete(threadId);
    } else {
      newSelected.add(threadId);
    }
    onSelectedThreadsChange(newSelected);
  };

  const selectAllThreads = () => {
    onSelectedThreadsChange(new Set(allThreadIds));
  };

  const clearAllThreads = () => {
    onSelectedThreadsChange(new Set());
  };

  const getThreadDisplayName = (threadId: string) => {
    // Since allThreadIds is already normalized, threadId should already be normalized
    return threadId; // 'main', '1', '2', etc.
  };

  const getThreadDescription = (threadId: string) => {
    if (threadId === 'main') {
      return 'Main thread (or undefined threadId)';
    }
    return `Thread ${threadId}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-96 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Thread Options</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          {/* Display Thread ID Option */}
          <div className="mb-6">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={displayThreadId}
                onChange={(e) => onDisplayThreadIdChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Display thread ID in messages
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-5">
              Shows [threadId] after timestamp in log messages
            </p>
          </div>

          {/* Thread Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">
                Threads to Display
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={selectAllThreads}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  All
                </button>
                <button
                  onClick={clearAllThreads}
                  className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  None
                </button>
              </div>
            </div>

            {/* Thread List */}
            {allThreadIds.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No threads available
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {allThreadIds.map((threadId) => {
                  const isSelected = selectedThreads.has(threadId);
                  const isAllSelected = selectedThreads.size === 0; // Show all when none selected
                  
                  return (
                    <div
                      key={threadId}
                      onClick={() => toggleThread(threadId)}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                        isSelected || isAllSelected
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : isAllSelected
                              ? 'bg-green-100 border-green-400'
                              : 'border-gray-300'
                        }`}>
                          {isSelected && <Check size={12} className="text-white" />}
                          {!isSelected && isAllSelected && <Check size={12} className="text-green-600" />}
                        </div>
                        <span className="text-sm text-gray-700 font-mono">
                          {getThreadDisplayName(threadId)}
                        </span>
                      </div>
                      
                      <span className="text-xs text-gray-500">
                        {getThreadDescription(threadId)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
              <strong>Tip:</strong> When no threads are selected, all threads are shown. 
              Select specific threads to filter to only those threads.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>
              {selectedThreads.size === 0 
                ? `Showing all ${allThreadIds.length} thread${allThreadIds.length !== 1 ? 's' : ''}`
                : `${selectedThreads.size} of ${allThreadIds.length} thread${allThreadIds.length !== 1 ? 's' : ''} selected`
              }
            </span>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreadsModal;