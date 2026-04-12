'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Real-time metrics hook using WebSocket
 * Receives progressive metrics updates as data is indexed
 */
export function useRealtimeMetrics(userId, analysisId) {
  const [metrics, setMetrics] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  
  useEffect(() => {
    if (!userId) return;
    
    // Connect to WebSocket
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000/ws';
    const ws = new WebSocket(`${wsUrl}?userId=${userId}`);
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      setError(null);
      
      // Register user
      ws.send(JSON.stringify({
        type: 'register',
        userId: userId
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle metrics update
        if (message.type === 'metrics_update') {
          // Only update if it's for the current analysis
          if (!analysisId || message.analysisId === analysisId) {
            setMetrics(message.metrics);
            if (message.progress !== undefined) {
              setProgress(message.progress);
            }
          }
        }
        
        // Handle progress update
        if (message.type === 'progress') {
          setProgress(message.data?.progress || 0);
        }
        
        // Handle completion
        if (message.type === 'completion') {
          console.log('✅ Analysis complete');
          setProgress(100);
        }
        
        // Handle error
        if (message.type === 'error') {
          console.error('WebSocket error:', message.data);
          setError(message.data?.message || 'An error occurred');
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };
    
    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      setError('Connection error');
      setIsConnected(false);
    };
    
    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setIsConnected(false);
    };
    
    wsRef.current = ws;
    
    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [userId, analysisId]);
  
  return { 
    metrics, 
    progress, 
    isConnected, 
    error,
    reconnect: () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    }
  };
}
