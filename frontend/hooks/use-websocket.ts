"use client"

import { useEffect, useState } from 'react'
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

export const useWebSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [metricsUpdate, setMetricsUpdate] = useState<MetricsUpdate | null>(null)

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
    }
  }, [])

  return {
    socket,
    isConnected,
    metricsUpdate
  }
}
