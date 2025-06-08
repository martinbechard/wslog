import React from 'react';
import { LogMessage, LogLevel } from '@wslog/shared';
import { Clock, Tag, User } from 'lucide-react';

interface LogViewerProps {
  logs: LogMessage[];
  filters: {
    levels: LogLevel[];
    sources: string[];
    regexInclude: string[];
    regexExclude: string[];
  };
}

interface LogEntryProps {
  log: LogMessage;
  index: number;
}

const LogEntry: React.FC<LogEntryProps> = ({ log, index }) => {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${time}.${ms}`;
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warn':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'debug':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return '❌';
      case 'warn':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'debug':
        return '🔍';
      default:
        return '📝';
    }
  };

  return (
    <div className={`log-entry level-${log.level} animate-slide-in`} style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 text-lg">
          {getLevelIcon(log.level)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getLevelColor(log.level)}`}>
              {log.level.toUpperCase()}
            </span>
            
            <div className="flex items-center text-xs text-gray-500">
              <Clock className="w-3 h-3 mr-1" />
              {formatTimestamp(log.timestamp)}
            </div>
            
            {log.source && (
              <div className="flex items-center text-xs text-gray-500">
                <User className="w-3 h-3 mr-1" />
                {log.source}
              </div>
            )}
            
            {log.threadId && (
              <div className="flex items-center text-xs text-gray-500">
                <Tag className="w-3 h-3 mr-1" />
                Thread {log.threadId}
              </div>
            )}
          </div>
          
          <div className="text-gray-900 break-words">
            {log.message}
          </div>
          
          {log.data && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                Additional Data
              </summary>
              <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(log.data, null, 2)}
              </pre>
            </details>
          )}
          
          {log.stack && (
            <details className="mt-2">
              <summary className="text-xs text-red-500 cursor-pointer hover:text-red-700">
                Stack Trace
              </summary>
              <pre className="mt-1 text-xs bg-red-50 p-2 rounded overflow-auto max-h-32 font-mono">
                {log.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};

const LogViewer: React.FC<LogViewerProps> = ({ logs, filters }) => {
  const filteredLogs = logs.filter(log => {
    // Filter by levels
    if (filters.levels.length > 0 && !filters.levels.includes(log.level)) {
      return false;
    }
    
    // Filter by sources
    if (filters.sources.length > 0 && (!log.source || !filters.sources.includes(log.source))) {
      return false;
    }
    
    // Filter by include regex
    if (filters.regexInclude.length > 0) {
      const includeMatch = filters.regexInclude.some(pattern => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(log.message);
        } catch {
          return false;
        }
      });
      if (!includeMatch) return false;
    }
    
    // Filter by exclude regex
    if (filters.regexExclude.length > 0) {
      const excludeMatch = filters.regexExclude.some(pattern => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(log.message);
        } catch {
          return false;
        }
      });
      if (excludeMatch) return false;
    }
    
    return true;
  });

  if (filteredLogs.length === 0 && logs.length > 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 text-4xl mb-2">🔍</div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No matching logs</h3>
        <p className="text-gray-500">
          {logs.length} logs hidden by current filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredLogs.map((log, index) => (
        <LogEntry key={log.id} log={log} index={index} />
      ))}
    </div>
  );
};

export default LogViewer;
