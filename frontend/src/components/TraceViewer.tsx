import React, { useState, useMemo, useEffect } from 'react';
import type { UnifiedLogMessage } from '@wslog/shared';
import { ChevronRight, ChevronDown, Eye, Maximize2, Minimize2 } from 'lucide-react';

export interface ViewSettings {
  maxTraceLevel: number;
  messageLength: number;
  enableCollapse: boolean;
  showCaller: boolean;
  showLevel: boolean;
  showFunctionName: boolean;
  displayThreadId?: boolean;
}

interface TraceViewerProps {
  messages: UnifiedLogMessage[];
  viewSettings: ViewSettings;
  collapseMode: 'expand' | 'collapse';
  onCollapseModeChange: (mode: 'expand' | 'collapse') => void;
}

const TraceViewer: React.FC<TraceViewerProps> = ({ 
  messages, 
  viewSettings, 
  collapseMode, 
  onCollapseModeChange 
}) => {
  const [collapsedEntries, setCollapsedEntries] = useState<Set<string>>(new Set());
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [manuallyTouchedEntries, setManuallyTouchedEntries] = useState<Set<string>>(new Set());

  // Build entry-exit mapping and filter by max trace level
  const { filteredMessages, entryExitMap } = useMemo(() => {
    const filtered = messages.filter(msg => 
      !msg.nestingLevel || msg.nestingLevel <= viewSettings.maxTraceLevel
    );

    const map = new Map<string, UnifiedLogMessage>();
    filtered.forEach(msg => {
      if (msg.type === 'trace-exit') {
        // Find corresponding entry
        const entry = filtered.find(m => 
          m.type === 'trace-entry' && 
          m.functionName === msg.functionName &&
          m.nestingLevel === msg.nestingLevel &&
          m.timestamp < msg.timestamp
        );
        if (entry) {
          map.set(entry.id, msg);
        }
      }
    });

    return { filteredMessages: filtered, entryExitMap: map };
  }, [messages, viewSettings.maxTraceLevel]);

  // Build collapse hierarchy
  const collapseHierarchy = useMemo(() => {
    const hierarchy = new Map<string, UnifiedLogMessage[]>();
    
    filteredMessages.forEach(msg => {
      if (msg.type === 'trace-entry') {
        const children: UnifiedLogMessage[] = [];
        const entryLevel = msg.nestingLevel || 0;
        const entryIndex = filteredMessages.indexOf(msg);
        
        // Find all messages until the corresponding exit
        const exitMsg = entryExitMap.get(msg.id);
        const exitIndex = exitMsg ? filteredMessages.indexOf(exitMsg) : filteredMessages.length;
        
        for (let i = entryIndex + 1; i < exitIndex; i++) {
          const child = filteredMessages[i];
          if (child.nestingLevel && child.nestingLevel > entryLevel) {
            children.push(child);
          }
        }
        
        hierarchy.set(msg.id, children);
      }
    });
    
    return hierarchy;
  }, [filteredMessages, entryExitMap]);

  // Apply default collapse state to new trace entries based on collapseMode
  // But respect manual user overrides
  useEffect(() => {
    if (collapseMode === 'collapse') {
      // Auto-collapse new trace entries that haven't been manually touched
      const newEntries = filteredMessages.filter(msg => 
        msg.type === 'trace-entry' && 
        collapseHierarchy.has(msg.id) &&
        !collapsedEntries.has(msg.id) &&
        !manuallyTouchedEntries.has(msg.id) // Don't auto-collapse manually touched entries
      );
      
      if (newEntries.length > 0) {
        setCollapsedEntries(prev => {
          const newSet = new Set(prev);
          newEntries.forEach(entry => newSet.add(entry.id));
          return newSet;
        });
      }
    }
  }, [filteredMessages, collapseHierarchy, collapseMode, collapsedEntries, manuallyTouchedEntries]);

  const toggleCollapse = (entryId: string) => {
    if (!viewSettings.enableCollapse) return;
    
    // Mark this entry as manually touched
    setManuallyTouchedEntries(prev => new Set(prev).add(entryId));
    
    const newCollapsed = new Set(collapsedEntries);
    if (newCollapsed.has(entryId)) {
      newCollapsed.delete(entryId);
    } else {
      newCollapsed.add(entryId);
    }
    setCollapsedEntries(newCollapsed);
  };

  const toggleMessageExpansion = (messageId: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedMessages(newExpanded);
  };

  const isMessageHidden = (msg: UnifiedLogMessage): boolean => {
    // Check if this message is a child of any collapsed entry
    for (const [entryId, children] of collapseHierarchy.entries()) {
      if (collapsedEntries.has(entryId) && children.includes(msg)) {
        return true;
      }
    }
    
    // Check if this is an exit message for a collapsed entry
    for (const [entryId, exitMsg] of entryExitMap.entries()) {
      if (collapsedEntries.has(entryId) && exitMsg.id === msg.id) {
        return true;
      }
    }
    
    return false;
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    });
  };

  const getTypeDisplayName = (type: string): string => {
    switch (type) {
      case 'trace-entry': return 'Entry';
      case 'trace-exit': return 'Exit';
      case 'info': return 'Info';
      case 'warn': return 'Warn';
      case 'error': return 'Error';
      case 'debug': return 'Debug';
      default: return type;
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'trace-entry': return 'text-blue-600';
      case 'trace-exit': return 'text-blue-500';
      case 'info': return 'text-green-600';
      case 'warn': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      case 'debug': return 'text-gray-500';
      default: return 'text-gray-700';
    }
  };

  const truncateMessage = (message: string, maxLength: number): { text: string; isTruncated: boolean } => {
    if (message.length <= maxLength) {
      return { text: message, isTruncated: false };
    }
    return { text: message.substring(0, maxLength) + '...', isTruncated: true };
  };

  const getThreadLabel = (threadId: number | string | undefined): string => {
    return threadId ? String(threadId) : 'main';
  };

  const renderMessage = (msg: UnifiedLogMessage) => {
    if (isMessageHidden(msg)) return null;

    const isEntry = msg.type === 'trace-entry';
    const isCollapsed = collapsedEntries.has(msg.id);
    const isExpanded = expandedMessages.has(msg.id);
    const canCollapse = viewSettings.enableCollapse && isEntry && collapseHierarchy.has(msg.id);
    const nestingLevel = msg.nestingLevel || 0;

    // Determine message length based on collapse state
    const messageLength = isCollapsed ? 50 : viewSettings.messageLength;
    const { text: truncatedMessage, isTruncated } = truncateMessage(msg.message, messageLength);
    
    return (
      <div key={msg.id} className="font-mono text-sm">
        {/* Main message line */}
        <div 
          className={`flex items-start space-x-2 py-1 px-2 ${
            isCollapsed ? 'bg-gray-50 border border-gray-200 rounded' : ''
          }`}
          style={{ marginLeft: `${nestingLevel * 20}px` }}
        >
          {/* Collapse/Expand Toggle */}
          {canCollapse && (
            <button
              onClick={() => toggleCollapse(msg.id)}
              className="flex-shrink-0 text-blue-600 hover:text-blue-800 mt-0.5"
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
          
          {/* Spacing for non-collapsible messages */}
          {!canCollapse && <div className="w-4 flex-shrink-0" />}
          
          {/* Timestamp */}
          <span className="text-gray-500 flex-shrink-0">
            {formatTimestamp(msg.timestamp)}
          </span>

          {/* Thread ID (optional) */}
          {viewSettings.displayThreadId && (
            <span className="text-purple-500 text-xs flex-shrink-0">
              [{getThreadLabel(msg.threadId)}]
            </span>
          )}
          
          {/* Message Type */}
          <span className={`${getTypeColor(msg.type)} font-medium flex-shrink-0`}>
            {getTypeDisplayName(msg.type)}
          </span>
          
          {/* Optional Level */}
          {viewSettings.showLevel && (
            <span className="text-gray-400 text-xs flex-shrink-0">
              L{nestingLevel}
            </span>
          )}
          
          {/* Optional Function Name */}
          {viewSettings.showFunctionName && msg.functionName && (
            <span className="text-purple-600 flex-shrink-0">
              {msg.functionName}
            </span>
          )}
          
          {/* Optional Caller */}
          {viewSettings.showCaller && msg.caller && (
            <span className="text-gray-400 text-xs flex-shrink-0">
              {msg.caller}
            </span>
          )}
          
          {/* Message Content */}
          <div className="flex-1 min-w-0">
            <span className="break-words">
              {isExpanded ? msg.message : truncatedMessage}
            </span>
            
            {/* Show more/less toggle for non-collapsed messages */}
            {!isCollapsed && isTruncated && (
              <button
                onClick={() => toggleMessageExpansion(msg.id)}
                className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </div>

        {/* Additional data when expanded and not collapsed */}
        {!isCollapsed && msg.data && Object.keys(msg.data).length > 0 && (
          <div 
            className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded"
            style={{ marginLeft: `${nestingLevel * 20 + 20}px` }}
          >
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(msg.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const handleCollapseAll = () => {
    if (collapseMode === 'collapse') {
      // Already in collapse mode, turn it off (expand all)
      onCollapseModeChange('expand');
      setCollapsedEntries(new Set());
      setManuallyTouchedEntries(new Set()); // Reset manual overrides
    } else {
      // Switch to collapse mode
      onCollapseModeChange('collapse');
      const allEntryIds = Array.from(collapseHierarchy.keys());
      setCollapsedEntries(new Set(allEntryIds));
      setManuallyTouchedEntries(new Set()); // Reset manual overrides
    }
  };

  const handleExpandAll = () => {
    if (collapseMode === 'expand') {
      // Already in expand mode, do nothing (or could be used to force expand)
      setCollapsedEntries(new Set());
      setExpandedMessages(new Set());
      setManuallyTouchedEntries(new Set()); // Reset manual overrides
    } else {
      // Switch to expand mode
      onCollapseModeChange('expand');
      setCollapsedEntries(new Set());
      setExpandedMessages(new Set());
      setManuallyTouchedEntries(new Set()); // Reset manual overrides
    }
  };

  if (filteredMessages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <Eye className="mx-auto mb-2 text-gray-400" size={48} />
          <p>No log messages to display</p>
          <p className="text-sm mt-1">Adjust your filters or generate some logs to see results</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Collapse/Expand Controls */}
      {viewSettings.enableCollapse && collapseHierarchy.size > 0 && (
        <div className="mb-4 flex space-x-2">
          <button
            onClick={handleExpandAll}
            className={`flex items-center space-x-1 px-3 py-1 text-sm rounded transition-colors ${
              collapseMode === 'expand' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Maximize2 size={14} />
            <span>Expand All</span>
            {collapseMode === 'expand' && <span className="text-xs">(active)</span>}
          </button>
          <button
            onClick={handleCollapseAll}
            className={`flex items-center space-x-1 px-3 py-1 text-sm rounded transition-colors ${
              collapseMode === 'collapse' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Minimize2 size={14} />
            <span>Collapse All</span>
            {collapseMode === 'collapse' && <span className="text-xs">(active)</span>}
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-0">
        {filteredMessages.map(renderMessage)}
      </div>
    </div>
  );
};

export default TraceViewer;