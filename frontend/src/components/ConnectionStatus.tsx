import React, { useState } from 'react';
import { Wifi, WifiOff, Loader2, Settings, Check, X } from 'lucide-react';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

interface ConnectionStatusProps {
  connectionState: ConnectionState;
  serverUrl: string;
  onUrlChange: (url: string) => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  connectionState,
  serverUrl,
  onUrlChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempUrl, setTempUrl] = useState(serverUrl);

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'connecting':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'disconnected':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (connectionState) {
      case 'connected':
        return <Wifi className="w-4 h-4" />;
      case 'connecting':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4" />;
      default:
        return <WifiOff className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  const handleSaveUrl = () => {
    if (tempUrl.trim() && tempUrl !== serverUrl) {
      onUrlChange(tempUrl.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setTempUrl(serverUrl);
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveUrl();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className="flex items-center space-x-3">
      {/* Connection Status */}
      <div className={`flex items-center space-x-2 px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor()}`}>
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </div>

      {/* Server URL */}
      <div className="flex items-center space-x-2">
        {isEditing ? (
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="ws://localhost:8085"
              className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-0 w-48"
              autoFocus
            />
            <button
              onClick={handleSaveUrl}
              className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
              title="Save URL"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
              {serverUrl}
            </span>
            <button
              onClick={() => {
                setTempUrl(serverUrl);
                setIsEditing(true);
              }}
              className="p-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
              title="Edit server URL"
              disabled={connectionState === 'connecting'}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Connection Quality Indicator (if connected) */}
      {connectionState === 'connected' && (
        <div className="flex items-center space-x-1">
          <div className="w-1 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <div className="w-1 h-4 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-1 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
