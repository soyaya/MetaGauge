/**
 * TestServer Helper Class
 * 
 * Provides an isolated Express server instance for testing.
 * Manages server lifecycle, port allocation, and state reset.
 */

import express from 'express';
import http from 'http';

export class TestServer {
  constructor(options = {}) {
    this.app = null;
    this.server = null;
    this.port = options.port || 0; // 0 = random available port
    this.baseURL = null;
    this.options = options;
  }

  /**
   * Initialize and start the test server
   */
  async start() {
    if (this.server) {
      throw new Error('Server is already running');
    }

    // Import the Express app
    const { default: createApp } = await import('../../src/api/server.js');
    this.app = createApp || express();

    // Create HTTP server
    this.server = http.createServer(this.app);

    // Start listening
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, (err) => {
        if (err) {
          reject(err);
          return;
        }

        const address = this.server.address();
        this.port = address.port;
        this.baseURL = `http://localhost:${this.port}`;
        
        console.log(`✅ Test server started on ${this.baseURL}`);
        resolve();
      });
    });
  }

  /**
   * Stop the test server
   */
  async stop() {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          reject(err);
          return;
        }

        this.server = null;
        this.app = null;
        this.baseURL = null;
        
        console.log('✅ Test server stopped');
        resolve();
      });
    });
  }

  /**
   * Get the Express app instance
   */
  getApp() {
    if (!this.app) {
      throw new Error('Server is not running');
    }
    return this.app;
  }

  /**
   * Get the base URL for making requests
   */
  getBaseURL() {
    if (!this.baseURL) {
      throw new Error('Server is not running');
    }
    return this.baseURL;
  }

  /**
   * Reset server state (useful between tests)
   */
  async reset() {
    // Clear any cached modules
    if (this.app) {
      // Reset middleware state if needed
      // This is a placeholder for any state reset logic
    }
  }

  /**
   * Check if server is running
   */
  isRunning() {
    return this.server !== null;
  }
}

// Export singleton instance for convenience
let testServerInstance = null;

export function getTestServer(options = {}) {
  if (!testServerInstance) {
    testServerInstance = new TestServer(options);
  }
  return testServerInstance;
}

export async function startTestServer(options = {}) {
  const server = getTestServer(options);
  if (!server.isRunning()) {
    await server.start();
  }
  return server;
}

export async function stopTestServer() {
  if (testServerInstance && testServerInstance.isRunning()) {
    await testServerInstance.stop();
    testServerInstance = null;
  }
}
