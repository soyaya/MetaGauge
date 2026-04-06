"use client"

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

const API_URL = typeof window !== 'undefined' 
    ? (window as any).location?.origin?.includes('localhost') 
        ? 'http://localhost:3003' 
        : 'http://localhost:3003'
    : 'http://localhost:3003';

interface MetricsUpdate {
  total_projects: number;
  total_customers: number;
  total_revenue: number;
  avg_growth_score: number;
}

export const useWebSocket = (fallbackPollUrl?: string, fallbackInterval = 5000) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [metricsUpdate, setMetricsUpdate] = useState<MetricsUpdate | null>(null)
  const [fallbackData, setFallbackData] = useState<any>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Polling fallback
  useEffect(() => {
    if (!isConnected && fallbackPollUrl) {
      console.log('WebSocket disconnected, starting polling fallback...')
      
      const poll = async () => {
        try {
          const token = localStorage.getItem('token')
          const res = await fetch(fallbackPollUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          })
          if (res.ok) {
            const data = await res.json()
            setFallbackData(data)
          }
        } catch (err) {
          console.error('Polling failed:', err)
        }
      }

      poll() // immediate first poll
      pollIntervalRef.current = setInterval(poll, fallbackInterval)

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
      }
    } else if (isConnected && pollIntervalRef.current) {
      // Stop polling when WebSocket reconnects
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
      console.log('WebSocket reconnected, stopping polling fallback')
    }
  }, [isConnected, fallbackPollUrl, fallbackInterval])

  useEffect(() => {
    const socketInstance = io(API_URL)

    socketInstance.on('connect', () => {
      console.log('WebSocket connected')
      setIsConnected(true)
      socketInstance.emit('join-dashboard')
    })

    socketInstance.on('disconnect', () => {
      console.log('WebSocket disconnected')
      setIsConnected(false)
    })

    socketInstance.on('metrics-update', (data: MetricsUpdate) => {
      console.log('Received metrics update:', data)
      setMetricsUpdate(data)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  return {
    socket,
    isConnected,
    metricsUpdate,
    fallbackData
  }
}
