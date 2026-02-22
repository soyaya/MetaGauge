/**
 * WebSocket Event Emitter
 * Broadcasts real-time updates to connected clients
 */

class WebSocketEmitter {
  constructor() {
    this.clients = new Map(); // userId -> WebSocket
  }

  register(userId, ws) {
    this.clients.set(userId, ws);
  }

  unregister(userId) {
    this.clients.delete(userId);
  }

  emit(userId, event, data) {
    const ws = this.clients.get(userId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ event, data, timestamp: Date.now() }));
    }
  }

  broadcast(event, data) {
    this.clients.forEach(ws => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ event, data, timestamp: Date.now() }));
      }
    });
  }

  // Event helpers
  analysisProgress(userId, analysisId, progress) {
    this.emit(userId, 'analysis:progress', { analysisId, progress });
  }

  analysisComplete(userId, analysisId) {
    this.emit(userId, 'analysis:complete', { analysisId });
  }

  newTransaction(userId, transaction) {
    this.emit(userId, 'monitoring:transaction', transaction);
  }

  alertTriggered(userId, alert) {
    this.emit(userId, 'alert:triggered', alert);
  }
}

export default new WebSocketEmitter();
