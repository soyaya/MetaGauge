/**
 * WebSocket client with polling fallback
 */
export class WebSocketClient {
  constructor(url, onMessage) {
    this.url = url;
    this.onMessage = onMessage;
    this.ws = null;
    this.pollInterval = null;
    this.isPolling = false;
    this.connect();
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.stopPolling();
      };
      
      this.ws.onmessage = (event) => {
        this.onMessage(JSON.parse(event.data));
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected, falling back to polling');
        this.startPolling();
      };
      
      this.ws.onerror = () => {
        console.log('WebSocket error, falling back to polling');
        this.startPolling();
      };
    } catch (error) {
      console.log('WebSocket failed to connect, using polling');
      this.startPolling();
    }
  }

  startPolling() {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/onboarding/status');
        const data = await response.json();
        this.onMessage(data);
      } catch (error) {
        console.error('Polling failed:', error);
      }
    }, 5000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      this.isPolling = false;
    }
  }

  close() {
    this.stopPolling();
    if (this.ws) {
      this.ws.close();
    }
  }
}
