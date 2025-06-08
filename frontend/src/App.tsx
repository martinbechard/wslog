import { useState, useEffect, useRef } from 'react';
import { LogMessage, TraceEntry, UnifiedLogMessage } from '@wslog/shared';
import TraceViewer, { ViewSettings } from './components/TraceViewer';
import FilterPanel, { FilterSettings } from './components/FilterPanel';
import StatsPanel from './components/StatsPanel';
import ConnectionStatus from './components/ConnectionStatus';
import ThreadsModal from './components/ThreadsModal';
import { Filter, Trash2, BarChart3, Pause, Play } from 'lucide-react';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Local Storage utilities
const STORAGE_KEYS = {
  showStats: 'wslog-show-stats',
  filterSettings: 'wslog-filter-settings',
  levelFilters: 'wslog-level-filters',
  collapseMode: 'wslog-collapse-mode',
  showFunctionCalls: 'wslog-show-function-calls',
  selectedThreads: 'wslog-selected-threads',
  displayThreadId: 'wslog-display-thread-id',
  isPaused: 'wslog-is-paused'
};

// Clean up old localStorage keys that are no longer used
const cleanupOldSettings = () => {
  const oldKeys = ['wslog-view-settings']; // Remove old view settings
  oldKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
    }
  });
};

const loadFromStorage = (key: string, defaultValue: any) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const saveToStorage = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore localStorage errors
  }
};

// Helper function to normalize thread IDs
const normalizeThreadId = (threadId: number | string | undefined | null): string => {
  if (threadId === undefined || threadId === null || threadId === '') {
    return 'main';
  }
  return String(threadId);
};

// Local conversion function
function toUnifiedLogMessage(msg: LogMessage | TraceEntry): UnifiedLogMessage {
  if ('type' in msg && 'functionName' in msg) {
    // This is a TraceEntry
    let unifiedType: UnifiedLogMessage['type'];
    switch (msg.type) {
      case 'entry':
        unifiedType = 'trace-entry';
        break;
      case 'exit':
        unifiedType = 'trace-exit';
        break;
      case 'log':
        unifiedType = msg.level; // Use the level as type for log entries
        break;
      case 'error':
        unifiedType = 'error';
        break;
      default:
        unifiedType = msg.level; // Fallback to level
    }
    
    return {
      ...msg,
      type: unifiedType,
      functionName: msg.functionName,
      args: msg.args,
      returnValue: msg.returnValue,
      executionTime: msg.executionTime,
    };
  } else {
    // This is a LogMessage  
    return {
      ...msg,
      type: msg.level, // Use level as type for regular log messages
    };
  }
}

function App() {
  // Clean up old settings on first load
  useEffect(() => {
    cleanupOldSettings();
  }, []);

  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>('connecting');
  const [serverUrl, setServerUrl] = useState('ws://localhost:8085');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isThreadsModalOpen, setIsThreadsModalOpen] = useState(false);
  
  // Load settings from localStorage
  const [showStats, setShowStats] = useState(() => loadFromStorage(STORAGE_KEYS.showStats, true));
  const [selectedLevels, setSelectedLevels] = useState<Set<LogLevel>>(() => 
    new Set(loadFromStorage(STORAGE_KEYS.levelFilters, []))
  );
  const [collapseMode, setCollapseMode] = useState<'expand' | 'collapse'>(() => 
    loadFromStorage(STORAGE_KEYS.collapseMode, 'expand')
  );
  const [showFunctionCalls, setShowFunctionCalls] = useState(() => 
    loadFromStorage(STORAGE_KEYS.showFunctionCalls, true)
  );
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(() => 
    new Set(loadFromStorage(STORAGE_KEYS.selectedThreads, []))
  );
  const [displayThreadId, setDisplayThreadId] = useState(() => 
    loadFromStorage(STORAGE_KEYS.displayThreadId, false)
  );
  const [isPaused, setIsPaused] = useState(() => 
    loadFromStorage(STORAGE_KEYS.isPaused, false)
  );
  
  const wsRef = useRef<WebSocket | null>(null);
  const pendingMessagesRef = useRef<{logs: LogMessage[], traces: TraceEntry[]}>({logs: [], traces: []});

  // Simplified filter settings (removed threadId and logType)
  const [filterSettings, setFilterSettings] = useState<FilterSettings>(() => 
    loadFromStorage(STORAGE_KEYS.filterSettings, {
      startTime: '',
      endTime: '',
      regexInclude: [],
      regexExclude: [],
    })
  );

  // Simplified view settings - always enabled with good defaults
  const viewSettings: ViewSettings = {
    maxTraceLevel: 10,
    messageLength: 1000, // Always use long messages
    enableCollapse: true, // Always enabled
    showCaller: false,
    showLevel: false,  
    showFunctionName: false,
    displayThreadId: displayThreadId
  };

  // Save settings to localStorage when they change
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.showStats, showStats);
  }, [showStats]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.filterSettings, filterSettings);
  }, [filterSettings]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.levelFilters, Array.from(selectedLevels));
  }, [selectedLevels]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.collapseMode, collapseMode);
  }, [collapseMode]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.showFunctionCalls, showFunctionCalls);
  }, [showFunctionCalls]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.selectedThreads, Array.from(selectedThreads));
  }, [selectedThreads]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.displayThreadId, displayThreadId);
  }, [displayThreadId]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.isPaused, isPaused);
  }, [isPaused]);

  // Process pending messages when resumed
  useEffect(() => {
    if (!isPaused && (pendingMessagesRef.current.logs.length > 0 || pendingMessagesRef.current.traces.length > 0)) {
      setLogs(prev => [...prev, ...pendingMessagesRef.current.logs]);
      setTraces(prev => [...prev, ...pendingMessagesRef.current.traces]);
      pendingMessagesRef.current = {logs: [], traces: []};
    }
  }, [isPaused]);

  // WebSocket connection
  const connectWebSocket = (url: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setConnectionStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to WSLog server');
      setConnectionStatus('connected');
      
      // Subscribe to both logs and traces
      ws.send(JSON.stringify({
        type: 'subscribe',
        route: '/logs'
      }));
      
      ws.send(JSON.stringify({
        type: 'subscribe', 
        route: '/trace'
      }));
    };

    ws.onmessage = (event) => {
      try {
        const serverMessage = JSON.parse(event.data);
        
        if (serverMessage.type === 'log') {
          const logMessage = serverMessage.data as LogMessage;
          if (isPaused) {
            pendingMessagesRef.current.logs.push(logMessage);
          } else {
            setLogs(prev => [...prev, logMessage]);
          }
        } else if (serverMessage.type === 'trace') {
          const traceEntry = serverMessage.data as TraceEntry;
          if (isPaused) {
            pendingMessagesRef.current.traces.push(traceEntry);
          } else {
            setTraces(prev => [...prev, traceEntry]);
          }
        } else if (serverMessage.type === 'status') {
          console.log('Server status:', serverMessage.status);
        }
      } catch (error) {
        console.error('Error parsing server message:', error);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from WSLog server');
      setConnectionStatus('disconnected');
      
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.CLOSED) {
          connectWebSocket(url);
        }
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };
  };

  useEffect(() => {
    connectWebSocket(serverUrl);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleUrlChange = (newUrl: string) => {
    setServerUrl(newUrl);
    connectWebSocket(newUrl);
  };

  // Convert to unified messages for unified view
  const unifiedLogs: UnifiedLogMessage[] = logs.map(toUnifiedLogMessage);
  const unifiedTraces: UnifiedLogMessage[] = traces.map(toUnifiedLogMessage);
  const allMessages = [...unifiedLogs, ...unifiedTraces].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Apply filtering logic
  const filteredMessages = allMessages.filter(msg => {
    // Time range filter
    if (filterSettings.startTime) {
      const messageTime = new Date(msg.timestamp);
      const startTime = new Date(filterSettings.startTime);
      if (messageTime < startTime) {
        return false;
      }
    }

    if (filterSettings.endTime) {
      const messageTime = new Date(msg.timestamp);
      const endTime = new Date(filterSettings.endTime);
      if (messageTime > endTime) {
        return false;
      }
    }

    // Regex filtering
    const messageText = msg.message;
    
    // Check include patterns (must match at least one if any are defined)
    if (filterSettings.regexInclude && filterSettings.regexInclude.length > 0) {
      const includeMatches = filterSettings.regexInclude.some(pattern => {
        if (!pattern.trim()) return false;
        try {
          return new RegExp(pattern, 'i').test(messageText);
        } catch {
          return false; // Invalid regex
        }
      });
      if (!includeMatches) {
        return false;
      }
    }

    // Check exclude patterns (must not match any)
    if (filterSettings.regexExclude && filterSettings.regexExclude.length > 0) {
      const excludeMatches = filterSettings.regexExclude.some(pattern => {
        if (!pattern.trim()) return false;
        try {
          return new RegExp(pattern, 'i').test(messageText);
        } catch {
          return false; // Invalid regex
        }
      });
      if (excludeMatches) {
        return false;
      }
    }

    // Thread filtering - use normalized thread IDs
    if (selectedThreads.size > 0) {
      const normalizedThreadId = normalizeThreadId(msg.threadId);
      if (!selectedThreads.has(normalizedThreadId)) {
        return false;
      }
    }

    // Function call filtering
    const isFunctionCall = msg.type === 'trace-entry' || msg.type === 'trace-exit';
    if (!showFunctionCalls && isFunctionCall) {
      return false;
    }

    // Level filtering for non-function calls
    if (selectedLevels.size > 0) {
      if (isFunctionCall) {
        // For function calls, check if there are related messages with the selected levels
        if (!showFunctionCalls) {
          return false; // If we're not showing function calls at all, exclude them
        }
        // For now, include function calls if we're showing them and there are level filters
        return true;
      } else {
        // For regular log messages, check the level directly
        return selectedLevels.has(msg.level);
      }
    }

    return true;
  });

  // Get all available thread IDs - properly handle undefined/null thread IDs
  const allThreadIds = Array.from(new Set(allMessages
    .map(msg => normalizeThreadId(msg.threadId))
  )).sort();

  const clearMessages = () => {
    setLogs([]);
    setTraces([]);
    pendingMessagesRef.current = {logs: [], traces: []};
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filterSettings.startTime) count++;
    if (filterSettings.endTime) count++;
    if (filterSettings.regexInclude && filterSettings.regexInclude.some(p => p.trim())) count++;
    if (filterSettings.regexExclude && filterSettings.regexExclude.some(p => p.trim())) count++;
    return count;
  };

  // Calculate level counts
  const debugCount = logs.filter(l => l.level === 'debug').length;
  const infoCount = logs.filter(l => l.level === 'info').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;
  const errorCount = logs.filter(l => l.level === 'error').length;
  const functionCallCount = traces.filter(t => t.type === 'entry' || t.type === 'exit').length;

  // Level toggle handlers
  const toggleLevel = (level: LogLevel) => {
    const newSelected = new Set(selectedLevels);
    if (newSelected.has(level)) {
      newSelected.delete(level);
    } else {
      newSelected.add(level);
    }
    setSelectedLevels(newSelected);
  };

  const resetAllFilters = () => {
    setSelectedLevels(new Set());
    setShowFunctionCalls(true);
    setSelectedThreads(new Set());
  };

  const toggleCollapseMode = (mode: 'expand' | 'collapse') => {
    setCollapseMode(mode);
  };

  const toggleFunctionCalls = () => {
    setShowFunctionCalls(!showFunctionCalls);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const getPendingCount = () => {
    return pendingMessagesRef.current.logs.length + pendingMessagesRef.current.traces.length;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">WSLog Dashboard</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Real-time logging and trace visualization
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Active Filters/Settings Status */}
                <div className="flex items-center space-x-2 text-sm">
                  {getActiveFiltersCount() > 0 && (
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {getActiveFiltersCount()} filter{getActiveFiltersCount() !== 1 ? 's' : ''}
                    </span>
                  )}
                  {(selectedLevels.size > 0 || !showFunctionCalls || selectedThreads.size > 0) && (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      {[
                        selectedLevels.size > 0 ? `${selectedLevels.size} level${selectedLevels.size !== 1 ? 's' : ''}` : '',
                        !showFunctionCalls ? 'no func' : '',
                        selectedThreads.size > 0 ? `${selectedThreads.size} thread${selectedThreads.size !== 1 ? 's' : ''}` : ''
                      ].filter(Boolean).join(', ')} filtered
                    </span>
                  )}
                  {isPaused && getPendingCount() > 0 && (
                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                      {getPendingCount()} pending
                    </span>
                  )}
                </div>

                {/* Connection Status */}
                <ConnectionStatus
                  connectionState={connectionStatus}
                  serverUrl={serverUrl}
                  onUrlChange={handleUrlChange}
                />

                {/* Control Buttons */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={togglePause}
                    className={`flex items-center space-x-1 px-3 py-2 text-sm rounded transition-colors ${
                      isPaused 
                        ? 'bg-orange-600 text-white hover:bg-orange-700' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isPaused ? <Play size={16} /> : <Pause size={16} />}
                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                    {isPaused && getPendingCount() > 0 && (
                      <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-1">
                        {getPendingCount()}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setShowStats(!showStats)}
                    className={`flex items-center space-x-1 px-3 py-2 text-sm rounded transition-colors ${
                      showStats 
                        ? 'bg-green-600 text-white hover:bg-green-700' 
                        : 'bg-gray-600 text-white hover:bg-gray-700'
                    }`}
                  >
                    <BarChart3 size={16} />
                    <span>{showStats ? 'Hide Stats' : 'Show Stats'}</span>
                  </button>

                  <button
                    onClick={() => setIsFilterPanelOpen(true)}
                    className="flex items-center space-x-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    <Filter size={16} />
                    <span>Filters</span>
                    {getActiveFiltersCount() > 0 && (
                      <span className="ml-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {getActiveFiltersCount()}
                      </span>
                    )}
                  </button>
                  
                  <button
                    onClick={clearMessages}
                    disabled={filteredMessages.length === 0}
                    className="flex items-center space-x-1 px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 size={16} />
                    <span>Clear</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-6 py-4 overflow-auto">
          {/* Messages Section */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                {/* Left side - All button and level/func filters */}
                <div className="flex items-center space-x-2 text-sm">
                  <button
                    onClick={resetAllFilters}
                    className={`text-lg font-semibold transition-colors px-2 py-1 rounded ${
                      (selectedLevels.size === 0 && showFunctionCalls && selectedThreads.size === 0)
                        ? 'text-gray-900' 
                        : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50 cursor-pointer'
                    }`}
                  >
                    All <span className="font-bold">({filteredMessages.length})</span>
                  </button>
                  
                  {debugCount > 0 && (
                    <button
                      onClick={() => toggleLevel('debug')}
                      className={`px-2 py-1 rounded transition-colors ${
                        selectedLevels.has('debug')
                          ? 'bg-gray-600 text-white'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      debug <span className="font-medium">{debugCount}</span>
                    </button>
                  )}
                  {infoCount > 0 && (
                    <button
                      onClick={() => toggleLevel('info')}
                      className={`px-2 py-1 rounded transition-colors ${
                        selectedLevels.has('info')
                          ? 'bg-green-600 text-white'
                          : 'text-green-600 hover:bg-green-100'
                      }`}
                    >
                      info <span className="font-medium">{infoCount}</span>
                    </button>
                  )}
                  {warnCount > 0 && (
                    <button
                      onClick={() => toggleLevel('warn')}
                      className={`px-2 py-1 rounded transition-colors ${
                        selectedLevels.has('warn')
                          ? 'bg-yellow-600 text-white'
                          : 'text-yellow-600 hover:bg-yellow-100'
                      }`}
                    >
                      warning <span className="font-medium">{warnCount}</span>
                    </button>
                  )}
                  {errorCount > 0 && (
                    <button
                      onClick={() => toggleLevel('error')}
                      className={`px-2 py-1 rounded transition-colors ${
                        selectedLevels.has('error')
                          ? 'bg-red-600 text-white'
                          : 'text-red-600 hover:bg-red-100'
                      }`}
                    >
                      error <span className="font-medium">{errorCount}</span>
                    </button>
                  )}
                  {functionCallCount > 0 && (
                    <button
                      onClick={toggleFunctionCalls}
                      className={`px-2 py-1 rounded transition-colors ${
                        showFunctionCalls
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                      }`}
                    >
                      func <span className="font-medium">{functionCallCount}</span>
                    </button>
                  )}
                </div>
                
                {/* Right side - threads */}
                <div className="flex items-center space-x-4 text-sm">
                  {allThreadIds.length > 0 && (
                    <button
                      onClick={() => setIsThreadsModalOpen(true)}
                      className={`px-2 py-1 rounded transition-colors ${
                        selectedThreads.size > 0
                          ? 'bg-purple-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      threads <span className="font-medium">{allThreadIds.length}</span>
                      {selectedThreads.size > 0 && <span className="ml-1">({selectedThreads.size})</span>}
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-4">
              <TraceViewer 
                messages={filteredMessages} 
                viewSettings={viewSettings}
                collapseMode={collapseMode}
                onCollapseModeChange={toggleCollapseMode}
              />
            </div>
          </div>
        </main>
      </div>

      {/* Sidebar with Stats - Conditionally rendered */}
      {showStats && (
        <div className="w-80 bg-white border-l">
          <StatsPanel 
            logs={logs}
            traces={traces}
            connectionState={connectionStatus}
          />
        </div>
      )}

      {/* Filter Panel */}
      <FilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        filterSettings={filterSettings}
        onFilterChange={setFilterSettings}
        availableThreadIds={allThreadIds}
      />

      {/* Threads Modal */}
      <ThreadsModal
        isOpen={isThreadsModalOpen}
        onClose={() => setIsThreadsModalOpen(false)}
        allThreadIds={allThreadIds}
        selectedThreads={selectedThreads}
        onSelectedThreadsChange={setSelectedThreads}
        displayThreadId={displayThreadId}
        onDisplayThreadIdChange={setDisplayThreadId}
      />
    </div>
  );
}

export default App;