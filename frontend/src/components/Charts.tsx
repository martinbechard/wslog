import React, { useMemo } from 'react';
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { UnifiedLogMessage, LogLevel } from '@wslog/shared';
import { TrendingUp, Activity, AlertCircle, Info } from 'lucide-react';

interface ChartsProps {
  messages: UnifiedLogMessage[];
}

interface TimeSlot {
  timestamp: string;
  total: number;
  error: number;
  warn: number;
  info: number;
  debug: number;
}

const Charts: React.FC<ChartsProps> = ({ messages }) => {
  // Process data for charts
  const chartData = useMemo(() => {
    const now = new Date();
    const timeSlots: Record<string, TimeSlot> = {};
    
    // Group messages by 1-minute intervals for the last hour
    messages.forEach(msg => {
      const msgTime = new Date(msg.timestamp);
      const diffMinutes = Math.floor((now.getTime() - msgTime.getTime()) / (1000 * 60));
      
      if (diffMinutes <= 60) { // Last hour only
        const slotKey = Math.floor(diffMinutes / 1).toString();
        const slot = timeSlots[slotKey] || {
          timestamp: `${diffMinutes}m ago`,
          total: 0,
          error: 0,
          warn: 0,
          info: 0,
          debug: 0
        };
        
        slot.total++;
        
        // Type-safe level increment
        if (msg.level === 'error') slot.error++;
        else if (msg.level === 'warn') slot.warn++;
        else if (msg.level === 'info') slot.info++;
        else if (msg.level === 'debug') slot.debug++;
        
        timeSlots[slotKey] = slot;
      }
    });

    return Object.values(timeSlots).reverse(); // Most recent first
  }, [messages]);

  // Log level distribution
  const levelDistribution = useMemo(() => {
    const counts: Record<LogLevel, number> = { error: 0, warn: 0, info: 0, debug: 0 };
    
    messages.forEach(msg => {
      if (msg.level in counts) {
        counts[msg.level]++;
      }
    });

    return [
      { name: 'Error', value: counts.error, color: '#ef4444' },
      { name: 'Warning', value: counts.warn, color: '#f59e0b' },
      { name: 'Info', value: counts.info, color: '#10b981' },
      { name: 'Debug', value: counts.debug, color: '#6b7280' },
    ].filter(item => item.value > 0);
  }, [messages]);

  // Thread activity
  const threadActivity = useMemo(() => {
    const threadCounts: Record<string, number> = {};
    messages.forEach(msg => {
      if (msg.threadId) {
        const threadKey = `Thread ${msg.threadId}`;
        threadCounts[threadKey] = (threadCounts[threadKey] || 0) + 1;
      }
    });

    return Object.entries(threadCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 threads
  }, [messages]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = messages.length;
    const errors = messages.filter(m => m.level === 'error').length;
    const warnings = messages.filter(m => m.level === 'warn').length;
    const errorRate = total > 0 ? (errors / total * 100) : 0;
    
    return { total, errors, warnings, errorRate };
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-center h-32 text-gray-500">
            <div className="text-center">
              <Activity size={32} className="mx-auto mb-2 opacity-50" />
              <p>No data to display</p>
              <p className="text-sm">Start logging to see charts</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
      {/* Metrics Cards */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Messages</p>
            <p className="text-2xl font-bold text-gray-900">{metrics.total}</p>
          </div>
          <Activity className="text-blue-500" size={24} />
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Error Rate</p>
            <p className="text-2xl font-bold text-red-500">{metrics.errorRate.toFixed(1)}%</p>
          </div>
          <AlertCircle className="text-red-500" size={24} />
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Errors</p>
            <p className="text-2xl font-bold text-red-500">{metrics.errors}</p>
          </div>
          <AlertCircle className="text-red-500" size={24} />
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Warnings</p>
            <p className="text-2xl font-bold text-yellow-500">{metrics.warnings}</p>
          </div>
          <Info className="text-yellow-500" size={24} />
        </div>
      </div>

      {/* Message Volume Over Time */}
      <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp size={20} className="mr-2" />
          Message Volume (Last Hour)
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Area 
              type="monotone" 
              dataKey="total" 
              stroke="#3b82f6" 
              fill="#3b82f6" 
              fillOpacity={0.3}
              name="Total Messages"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Log Level Distribution */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Log Level Distribution</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={levelDistribution}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              dataKey="value"
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            >
              {levelDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Thread Activity */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Thread Activity</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={threadActivity} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={80} />
            <Tooltip />
            <Bar dataKey="count" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Message Levels Over Time */}
      <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Message Levels Over Time</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="error" stroke="#ef4444" name="Errors" strokeWidth={2} />
            <Line type="monotone" dataKey="warn" stroke="#f59e0b" name="Warnings" strokeWidth={2} />
            <Line type="monotone" dataKey="info" stroke="#10b981" name="Info" strokeWidth={2} />
            <Line type="monotone" dataKey="debug" stroke="#6b7280" name="Debug" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Charts;