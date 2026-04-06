/**
 * MetricsScheduler
 * Periodically recalculates metrics for all completed analyses.
 */

import { MetricsCalculator } from '../api/scripts/calculate-all-metrics.js';

export class MetricsScheduler {
  constructor(intervalMs = 5 * 60 * 1000) { // default: every 5 minutes
    this.intervalMs = intervalMs;
    this.timer = null;
  }

  start() {
    console.log(`📊 MetricsScheduler started (interval: ${this.intervalMs / 1000}s)`);
    // Run once immediately, then on interval
    this._run();
    this.timer = setInterval(() => this._run(), this.intervalMs);
    process.once('SIGTERM', () => this.stop());
    process.once('SIGINT',  () => this.stop());
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('📊 MetricsScheduler stopped');
    }
  }

  async _run() {
    try {
      const updated = await MetricsCalculator.recalculateAll();
      if (updated > 0) {
        console.log(`📊 MetricsScheduler: updated ${updated} analyses`);
      }
    } catch (err) {
      console.warn('⚠️ MetricsScheduler run failed:', err.message);
    }
  }
}

export default MetricsScheduler;
