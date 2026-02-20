/**
 * Marathon Sync State Management Hook
 * Uses localStorage for persistence and handles background sync state
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';

interface MarathonSyncState {
  isActive: boolean;
  analysisId: string | null;
  progress: number;
  syncCycle: number;
  startedAt: string | null;
  lastUpdate: string | null;
  totalTransactions: number;
  uniqueUsers: number;
  totalEvents: number;
  dataIntegrityScore: number;
  error: string | null;
  cycleStartTime: string | null;
  estimatedCycleDuration: string | null;
  cyclesCompleted: number;
}

interface MarathonSyncHook {
  syncState: MarathonSyncState;
  startMarathonSync: () => Promise<void>;
  stopMarathonSync: () => Promise<void>;
  refreshSyncState: () => Promise<void>;
  clearSyncState: () => void;
  isLoading: boolean;
}

const STORAGE_KEY = 'marathon-sync-state';
const POLL_INTERVAL = 3000; // 3 seconds

const defaultState: MarathonSyncState = {
  isActive: false,
  analysisId: null,
  progress: 0,
  syncCycle: 0,
  startedAt: null,
  lastUpdate: null,
  totalTransactions: 0,
  uniqueUsers: 0,
  totalEvents: 0,
  dataIntegrityScore: 100,
  error: null,
  cycleStartTime: null,
  estimatedCycleDuration: null,
  cyclesCompleted: 0,
};

export function useMarathonSync(): MarathonSyncHook {
  const [syncState, setSyncState] = useState<MarathonSyncState>(defaultState);
  const [isLoading, setIsLoading] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setSyncState(parsed);
        
        // Only resume monitoring if explicitly requested, not automatically
        // Remove auto-resume to prevent unwanted marathon sync starts
        console.log('📊 Loaded marathon sync state from localStorage (not auto-resuming)');
      } catch (error) {
        console.error('Failed to parse saved marathon sync state:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    return () => {
      mountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (syncState !== defaultState) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(syncState));
    }
  }, [syncState]);

  const updateSyncState = useCallback((updates: Partial<MarathonSyncState>) => {
    if (!mountedRef.current) return;
    
    setSyncState(prev => ({
      ...prev,
      ...updates,
      lastUpdate: new Date().toISOString(),
    }));
  }, []);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    let consecutiveFailures = 0;
    let lastProgressUpdate = Date.now();
    const PROGRESS_TIMEOUT = 2 * 60 * 1000; // 2 minutes without progress = timeout
    const MAX_CONSECUTIVE_FAILURES = 5;

    pollIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      
      try {
        // Get current sync status
        const [status, contractData] = await Promise.all([
          api.onboarding.getStatus(),
          api.onboarding.getDefaultContract()
        ]);

        // Reset failure counter on success
        consecutiveFailures = 0;

        // Check for progress timeout
        const currentTime = Date.now();
        const currentProgress = status.indexingProgress || 0;
        
        if (currentProgress > syncState.progress) {
          lastProgressUpdate = currentTime;
        } else if (currentTime - lastProgressUpdate > PROGRESS_TIMEOUT && syncState.isActive) {
          console.log('🚨 Progress timeout detected - sync appears stuck');
          updateSyncState({
            error: 'Sync appears to be stuck. Please try refreshing the page.',
            isStuck: true
          });
          return;
        }

        // Simplified status checking with better completion detection
        const isStillActive = (status.continuousSyncActive === true) || 
                             (currentProgress < 100 && status.continuousSync === true);

        // Simplified and more robust completion detection
        const isCompleted = 
          // Primary condition: progress is 100%
          currentProgress >= 100 ||
          
          // Secondary condition: backend says it's indexed
          (status.isIndexed === true) ||
          
          // Tertiary condition: has results and not actively syncing
          (contractData.fullResults?.fullReport?.summary?.totalTransactions > 0 && 
           !status.continuousSyncActive) ||
           
          // Fallback condition: timeout after 3 minutes
          (syncState.startedAt && 
           Date.now() - new Date(syncState.startedAt).getTime() > 3 * 60 * 1000);

        // Force completion if stuck at 30% for more than 2 minutes
        if (currentProgress === 30 && 
            syncState.startedAt && 
            Date.now() - new Date(syncState.startedAt).getTime() > 2 * 60 * 1000) {
          console.log('🚨 Forcing completion due to timeout at 30%');
          stopPolling();
          updateSyncState({
            isActive: false,
            progress: 100,
            error: null
          });
          
          // Refresh page to show results
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          return;
        }

        if (isCompleted && syncState.isActive) {
          console.log('🛑 Marathon sync completed - detected completion');
          console.log('   Progress:', currentProgress);
          console.log('   Is indexed:', status.isIndexed);
          console.log('   Continuous sync active:', status.continuousSyncActive);
          console.log('   Has results:', !!contractData.fullResults);
          
          stopPolling();
          updateSyncState({
            isActive: false,
            progress: 100,
            error: null
          });
          
          // Trigger page refresh after completion
          console.log('🔄 Marathon sync completed, refreshing page...');
          setTimeout(() => {
            window.location.reload();
          }, 2000); // 2 second delay to show completion
          
          return;
        }

        if (!isStillActive && syncState.isActive) {
          console.log('🛑 Marathon sync stopped - no longer active');
          stopPolling();
          updateSyncState({
            isActive: false,
            progress: Math.max(currentProgress, syncState.progress), // Don't decrease progress
            error: null
          });
          
          // If progress is 100%, refresh page
          if (currentProgress >= 100) {
            console.log('🔄 Sync stopped with 100% progress, refreshing page...');
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          }
          
          return;
        }

        // Update state with latest data
        const fullReport = contractData.fullResults?.fullReport;
        
        updateSyncState({
          progress: currentProgress,
          syncCycle: fullReport?.metadata?.syncCycle || 0,
          totalTransactions: fullReport?.summary?.totalTransactions || 0,
          uniqueUsers: fullReport?.summary?.uniqueUsers || 0,
          totalEvents: fullReport?.summary?.totalEvents || 0,
          dataIntegrityScore: fullReport?.metadata?.dataIntegrityScore || 100,
          cycleStartTime: fullReport?.metadata?.cycleStartTime || null,
          estimatedCycleDuration: fullReport?.metadata?.estimatedCycleDuration || null,
          cyclesCompleted: Math.max(0, (fullReport?.metadata?.syncCycle || 1) - 1),
          error: contractData.analysisError || null,
          lastUpdate: new Date().toISOString()
        });

        console.log('📊 Marathon sync update:', {
          progress: currentProgress,
          cycle: fullReport?.metadata?.syncCycle,
          transactions: fullReport?.summary?.totalTransactions,
          users: fullReport?.summary?.uniqueUsers,
          lastUpdate: new Date().toISOString()
        });

      } catch (error) {
        consecutiveFailures++;
        console.error(`Marathon sync polling error (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`, error);
        
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.log('🚨 Too many consecutive failures, stopping polling');
          updateSyncState({
            error: 'Connection issues detected. Please refresh the page.',
            isStuck: true
          });
          stopPolling();
        } else {
          updateSyncState({
            error: error instanceof Error ? error.message : 'Polling failed'
          });
        }
      }
    }, POLL_INTERVAL);
  }, [updateSyncState, syncState.progress, syncState.isActive]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startMarathonSync = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🚀 Starting marathon sync...');
      
      const response = await api.onboarding.refreshDefaultContract(true); // continuous = true
      
      updateSyncState({
        isActive: true,
        analysisId: response.analysisId,
        progress: response.progress || 10,
        syncCycle: 1,
        startedAt: new Date().toISOString(),
        error: null
      });

      // Start monitoring
      startPolling();
      
      console.log('✅ Marathon sync started successfully');
    } catch (error) {
      console.error('Failed to start marathon sync:', error);
      updateSyncState({
        isActive: false,
        error: error instanceof Error ? error.message : 'Failed to start sync'
      });
    } finally {
      setIsLoading(false);
    }
  }, [updateSyncState, startPolling]);

  const stopMarathonSync = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🛑 Stopping marathon sync...');
      
      const response = await api.onboarding.stopContinuousSync();
      
      stopPolling();
      
      updateSyncState({
        isActive: false,
        progress: 100,
        error: null
      });
      
      console.log('✅ Marathon sync stopped successfully:', response);
    } catch (error) {
      console.error('Failed to stop marathon sync:', error);
      updateSyncState({
        error: error instanceof Error ? error.message : 'Failed to stop sync'
      });
    } finally {
      setIsLoading(false);
    }
  }, [updateSyncState, stopPolling]);

  const refreshSyncState = useCallback(async () => {
    if (!syncState.isActive) return;
    
    try {
      const [status, contractData] = await Promise.all([
        api.onboarding.getStatus(),
        api.onboarding.getDefaultContract()
      ]);

      const fullReport = contractData.fullResults?.fullReport;
      
      updateSyncState({
        progress: status.indexingProgress || 0,
        syncCycle: fullReport?.metadata?.syncCycle || 0,
        totalTransactions: fullReport?.summary?.totalTransactions || 0,
        uniqueUsers: fullReport?.summary?.uniqueUsers || 0,
        totalEvents: fullReport?.summary?.totalEvents || 0,
        dataIntegrityScore: fullReport?.metadata?.dataIntegrityScore || 100,
        error: contractData.analysisError || null
      });
    } catch (error) {
      console.error('Failed to refresh sync state:', error);
      updateSyncState({
        error: error instanceof Error ? error.message : 'Failed to refresh state'
      });
    }
  }, [syncState.isActive, updateSyncState]);

  const clearSyncState = useCallback(() => {
    stopPolling();
    setSyncState(defaultState);
    localStorage.removeItem(STORAGE_KEY);
  }, [stopPolling]);

  return {
    syncState,
    startMarathonSync,
    stopMarathonSync,
    refreshSyncState,
    clearSyncState,
    isLoading,
  };
}