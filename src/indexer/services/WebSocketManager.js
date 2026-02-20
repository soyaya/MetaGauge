/**
 * WebSocket Manager for real-time updates
 */

export class WebSocketManager {
  constructor(wss) {
    this.wss = wss;
    this.clients = new Map(); // userId -> WebSocket
    this.messageBuffer = new Map(); // userId -> messages[]
  }

  /**
   * Register client connection
   */
  registerClient(userId, ws) {
    this.clients.set(userId, ws);
    
    // Send buffered messages
    const buffered = this.messageBuffer.get(userId) || [];
    buffered.forEach(msg => this.sendToClient(userId, msg));
    this.messageBuffer.delete(userId);
  }

  /**
   * Unregister client
   */
  unregisterClient(userId) {
    this.clients.delete(userId);
  }

  /**
   * Emit progress update
   */
  emitProgress(userId, data) {
    this.sendMessage(userId, {
      type: 'progress',
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit error
   */
  emitError(userId, error) {
    this.sendMessage(userId, {
      type: 'error',
      data: { message: error.message, stack: error.stack },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit completion
   */
  emitCompletion(userId, data) {
    this.sendMessage(userId, {
      type: 'completion',
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit metrics update
   */
  emitMetrics(userId, metrics) {
    this.sendMessage(userId, {
      type: 'metrics',
      data: metrics,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send message to client
   */
  sendMessage(userId, message) {
    const ws = this.clients.get(userId);
    
    if (ws && ws.readyState === 1) { // OPEN
      this.sendToClient(userId, message);
    } else {
      // Buffer message for reconnection
      if (!this.messageBuffer.has(userId)) {
        this.messageBuffer.set(userId, []);
      }
      this.messageBuffer.get(userId).push(message);
      
      // Keep only last 50 messages
      const buffer = this.messageBuffer.get(userId);
      if (buffer.length > 50) {
        buffer.shift();
      }
    }
  }

  /**
   * Send to client with serialization
   */
  sendToClient(userId, message) {
    const ws = this.clients.get(userId);
    if (ws) {
      try {
        ws.send(JSON.stringify(message, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        ));
      } catch (error) {
        console.error('WebSocket send error:', error);
      }
    }
  }
}
