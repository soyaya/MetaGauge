'use client';

import { useRealtimeMetrics } from '@/hooks/useRealtimeMetrics';

/**
 * Real-time metrics display component
 * Shows live updates as blockchain data is indexed
 */
export function RealtimeMetrics({ userId, analysisId }) {
  const { metrics, progress, isConnected, error } = useRealtimeMetrics(userId, analysisId);
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">⚠️ {error}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
        <span className="text-sm text-gray-600">
          {isConnected ? 'Live updates active' : 'Connecting...'}
        </span>
      </div>
      
      {/* Progress Bar */}
      {progress > 0 && progress < 100 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Indexing Progress</span>
            <span className="font-medium">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Unique Users"
            value={metrics.uniqueUsers?.toLocaleString() || '0'}
            live={isConnected}
          />
          <MetricCard
            title="Total Transactions"
            value={metrics.totalTransactions?.toLocaleString() || '0'}
            live={isConnected}
          />
          <MetricCard
            title="Success Rate"
            value={`${metrics.successRate?.toFixed(1) || '0'}%`}
            live={isConnected}
          />
          <MetricCard
            title="Blocks Processed"
            value={metrics.blocksProcessed?.toLocaleString() || '0'}
            live={isConnected}
          />
        </div>
      )}
      
      {!metrics && isConnected && (
        <div className="text-center py-8 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
          <p>Waiting for data...</p>
        </div>
      )}
    </div>
  );
}

/**
 * Individual metric card component
 */
function MetricCard({ title, value, live }) {
  return (
    <div className={`bg-white rounded-lg border p-4 ${live ? 'border-green-200' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-gray-600">{title}</p>
        {live && (
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
