import React, { useMemo } from 'react';
import { LogMessage, TraceEntry, LogLevel } from '@wslog/shared';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, MessageSquare, GitBranch, Clock, TrendingUp } from 'lucide-react';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

interface StatsPanelProps {
  logs: LogMessage[];
  traces: TraceEntry[];
  connectionState: ConnectionState;
}

interface LogLevelStats {
  level: string;
  count: number;
  color: string;
}

interface SourceStats {
  source: string;
  count: number;
}

interface TimeStats {
  time: string;
  logs: number;
  traces: number;
}

const LEVEL_COLORS = {
  error: '#ef4444',
  warn: '#f59e0b',
  info: '#3b82f6',
  debug: '#6b7280',
};

const StatsPanel: React.FC<StatsPanelProps> = ({ logs, traces, connectionState }) => {
  const stats = useMemo(() => {
    // Log level distribution
    const levelCounts: Record<LogLevel, number> = {
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
    };

    logs.forEach(log => {
      levelCounts[log.level]++;
    });

    traces.forEach(trace => {
      levelCounts[trace.level]++;
    });

    const levelStats: LogLevelStats[] = Object.entries(levelCounts).map(([level, count]) => ({
      level: level.toUpperCase(),
      count,
      color: LEVEL_COLORS[level as LogLevel],
    })).filter(stat => stat.count > 0);

    // Source distribution
    const sourceCounts: Record<string, number> = {};
    
    [...logs, ...traces].forEach(entry => {
      if (entry.source) {
        sourceCounts[entry.source] = (sourceCounts[entry.source] || 0) + 1;
      }
    });

    const sourceStats: SourceStats[] = Object.entries(sourceCounts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 sources

    // Time distribution (last 10 minutes in 1-minute buckets)
    const now = Date.now();
    const timeStats: TimeStats[] = [];
    
    for (let i = 9; i >= 0; i--) {
      const bucketStart = now - (i + 1) * 60000;
      const bucketEnd = now - i * 60000;
      const time = new Date(bucketEnd).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const logsInBucket = logs.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime >= bucketStart && logTime < bucketEnd;
      }).length;

      const tracesInBucket = traces.filter(trace => {
        const traceTime = new Date(trace.timestamp).getTime();
        return traceTime >= bucketStart && traceTime < bucketEnd;
      }).length;

      timeStats.push({
        time,
        logs: logsInBucket,
        traces: tracesInBucket,
      });
    }

    // Thread statistics
    const threadIds = new Set([...logs, ...traces].map(entry => entry.threadId).filter(Boolean));
    
    // Nesting level statistics
    const maxNestingLevel = Math.max(
      ...traces.map(trace => trace.nestingLevel || 0),
      0
    );

    // Recent activity (last 5 seconds)
    const recentCutoff = now - 5000;
    const recentLogs = logs.filter(log => new Date(log.timestamp).getTime() > recentCutoff).length;
    const recentTraces = traces.filter(trace => new Date(trace.timestamp).getTime() > recentCutoff).length;

    return {
      totalLogs: logs.length,
      totalTraces: traces.length,
      totalEntries: logs.length + traces.length,
      levelStats,
      sourceStats,
      timeStats,
      threadCount: threadIds.size,
      maxNestingLevel,
      recentActivity: recentLogs + recentTraces,
    };
  }, [logs, traces]);

  const getConnectionStatusInfo = () => {
    switch (connectionState) {
      case 'connected':
        return { icon: Activity, text: 'Live', color: 'text-green-600' };
      case 'connecting':
        return { icon: Activity, text: 'Connecting', color: 'text-yellow-600' };
      default:
        return { icon: Activity, text: 'Offline', color: 'text-red-600' };
    }
  };

  const connectionInfo = getConnectionStatusInfo();
  const ConnectionIcon = connectionInfo.icon;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Statistics</h2>
          <div className={`flex items-center space-x-1 ${connectionInfo.color}`}>
            <ConnectionIcon className="w-4 h-4" />
            <span className="text-sm font-medium">{connectionInfo.text}</span>
          </div>
        </div>
      </div>

      {/* Stats Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Logs</span>
            </div>
            <div className="text-xl font-bold text-blue-600 mt-1">{stats.totalLogs}</div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <GitBranch className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Traces</span>
            </div>
            <div className="text-xl font-bold text-purple-600 mt-1">{stats.totalTraces}</div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Threads</span>
            </div>
            <div className="text-xl font-bold text-green-600 mt-1">{stats.threadCount}</div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">Recent</span>
            </div>
            <div className="text-xl font-bold text-orange-600 mt-1">{stats.recentActivity}</div>
          </div>
        </div>

        {/* Additional Info */}
        {stats.maxNestingLevel > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <div className="text-sm font-medium text-indigo-900">Max Nesting Level</div>
            <div className="text-lg font-bold text-indigo-600">{stats.maxNestingLevel}</div>
          </div>
        )}

        {/* Log Level Distribution */}
        {stats.levelStats.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Log Levels</h3>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.levelStats}
                    dataKey="count"
                    nameKey="level"
                    cx="50%"
                    cy="50%"
                    outerRadius={50}
                    label={({ level, count }) => `${level}: ${count}`}
                    labelLine={false}
                  >
                    {stats.levelStats.map((entry) => (
                      <Cell key={`cell-${entry.level}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Activity Timeline */}
        {stats.timeStats.some(stat => stat.logs > 0 || stat.traces > 0) && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Activity (Last 10 min)</h3>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.timeStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={40}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="logs" stackId="a" fill="#3b82f6" name="Logs" />
                  <Bar dataKey="traces" stackId="a" fill="#8b5cf6" name="Traces" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top Sources */}
        {stats.sourceStats.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Top Sources</h3>
            <div className="space-y-2">
              {stats.sourceStats.slice(0, 5).map((stat) => (
                <div key={stat.source} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 truncate flex-1 mr-2 font-mono">
                    {stat.source}
                  </span>
                  <span className="text-xs font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded">
                    {stat.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {stats.totalEntries === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-2">📊</div>
            <p className="text-gray-500 text-sm">No data to display</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsPanel;
