/**
 * Export Service
 * Handles exporting analysis data to various formats
 */

import { createObjectCsvStringifier } from 'csv-writer';
import { AnalysisStorage } from '../api/database/index.js';

class ExportService {
  async exportToCSV(analysisId) {
    const analysis = await AnalysisStorage.findById(analysisId);
    if (!analysis) throw new Error('Analysis not found');

    const results = analysis.results || {};
    const rows = [];

    // Export transactions
    if (results.transactions) {
      results.transactions.forEach(tx => {
        rows.push({
          type: 'transaction',
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          timestamp: tx.timestamp,
          status: tx.status
        });
      });
    }

    // Export metrics
    if (results.metrics) {
      rows.push({
        type: 'metric',
        name: 'Total Transactions',
        value: results.metrics.totalTransactions || 0
      });
      rows.push({
        type: 'metric',
        name: 'Unique Users',
        value: results.metrics.uniqueUsers || 0
      });
      rows.push({
        type: 'metric',
        name: 'Total Volume',
        value: results.metrics.totalVolume || 0
      });
    }

    const csvStringifier = createObjectCsvStringifier({
      header: Object.keys(rows[0] || {}).map(key => ({ id: key, title: key }))
    });

    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(rows);
  }

  async exportToJSON(analysisId) {
    const analysis = await AnalysisStorage.findById(analysisId);
    if (!analysis) throw new Error('Analysis not found');

    return JSON.stringify({
      id: analysis.id,
      contractId: analysis.contractId,
      status: analysis.status,
      createdAt: analysis.createdAt,
      completedAt: analysis.completedAt,
      results: analysis.results
    }, null, 2);
  }
}

export default new ExportService();
