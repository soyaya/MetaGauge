#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Advanced Metrics Calculator for Smart Contract Analytics
 * Calculates real metrics from transaction data
 */
class AdvancedMetricsCalculator {

  /**
   * Calculate Transaction Volume from actual transaction values
   */
  calculateTransactionVolume(transactions) {
    let totalVolume = 0;
    let volume24h = 0;
    const now = Date.now() / 1000;
    const dayMs = 24 * 60 * 60;
    const ethToUsd = 2000; // ETH price in USD

    transactions.forEach(tx => {
      // Convert hex value to decimal (in ETH, then USD)
      const valueWei = this.hexToDecimal(tx.value || '0x0');
      const valueEth = valueWei / 1e18;
      const valueUsd = valueEth * ethToUsd;
      totalVolume += valueUsd;

      // 24h volume
      if ((now - tx.blockTimestamp) <= dayMs) {
        volume24h += valueUsd;
      }

      // Add event-driven volume (ERC20 transfers)
      if (tx.events) {
        tx.events.forEach(event => {
          if (event.topics && event.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
            // USDT has 6 decimals, convert to USD (1 USDT ≈ 1 USD)
            const rawValue = this.hexToDecimal(event.data || '0x0');
            const transferValueUsd = rawValue / 1e6;
            
            // Cap unreasonably large values (likely data errors)
            const cappedValue = Math.min(transferValueUsd, 1000000); // Cap at $1M per transfer
            
            totalVolume += cappedValue;
            if ((now - tx.blockTimestamp) <= dayMs) {
              volume24h += cappedValue;
            }
          }
        });
      }
    });

    return { totalVolume, volume24h };
  }

  /**
   * Calculate TVL (Total Value Locked) from contract interactions
   */
  calculateTVL(transactions) {
    let totalInflow = 0;
    let totalOutflow = 0;
    const ethToUsd = 2000;

    transactions.forEach(tx => {
      const valueWei = this.hexToDecimal(tx.value || '0x0');
      const valueUsd = (valueWei / 1e18) * ethToUsd;
      
      // Inflow: transactions TO the contract
      if (tx.to && tx.to.toLowerCase() === process.env.CONTRACT_ADDRESS?.toLowerCase()) {
        totalInflow += valueUsd;
      }
      
      // Outflow: transactions FROM the contract
      if (tx.from && tx.from.toLowerCase() === process.env.CONTRACT_ADDRESS?.toLowerCase()) {
        totalOutflow += valueUsd;
      }

      // Event-based TVL calculation
      if (tx.events) {
        tx.events.forEach(event => {
          if (event.topics && event.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
            // USDT transfers (1 USDT ≈ 1 USD)
            const transferValueUsd = this.hexToDecimal(event.data || '0x0') / 1e6;
            const fromAddr = '0x' + event.topics[1]?.slice(-40);
            const toAddr = '0x' + event.topics[2]?.slice(-40);
            
            if (toAddr.toLowerCase() === process.env.CONTRACT_ADDRESS?.toLowerCase()) {
              totalInflow += transferValueUsd;
            }
            if (fromAddr.toLowerCase() === process.env.CONTRACT_ADDRESS?.toLowerCase()) {
              totalOutflow += transferValueUsd;
            }
          }
        });
      }
    });

    return Math.max(0, totalInflow - totalOutflow);
  }

  /**
   * Calculate UX Grade based on .env configuration
   */
  calculateUXGrade(transactions, sessionDuration, bottlenecks) {
    const config = {
      maxSessionTime: parseInt(process.env.UX_MAX_SESSION_TIME || '3600'), // 1 hour
      maxBottlenecks: parseInt(process.env.UX_MAX_BOTTLENECKS || '5'),
      minSuccessRate: parseFloat(process.env.UX_MIN_SUCCESS_RATE || '0.8')
    };

    const successRate = transactions.filter(tx => tx.status === true).length / Math.max(transactions.length, 1);
    const avgSessionTime = sessionDuration || 0;
    
    let grade = 100;
    
    // Deduct points for poor metrics
    if (successRate < config.minSuccessRate) grade -= (config.minSuccessRate - successRate) * 100;
    if (avgSessionTime > config.maxSessionTime) grade -= 20;
    if (bottlenecks > config.maxBottlenecks) grade -= bottlenecks * 5;
    
    grade = Math.max(0, Math.min(100, grade));
    
    return {
      grade: grade.toFixed(1),
      letter: grade >= 90 ? 'A' : grade >= 80 ? 'B' : grade >= 70 ? 'C' : grade >= 60 ? 'D' : 'F'
    };
  }

  /**
   * Calculate Session Duration per wallet
   */
  calculateSessionDuration(transactions) {
    const walletSessions = {};
    
    transactions.forEach(tx => {
      const wallet = tx.from;
      if (!walletSessions[wallet]) {
        walletSessions[wallet] = {
          firstTx: tx.blockTimestamp,
          lastTx: tx.blockTimestamp,
          txCount: 0
        };
      }
      
      walletSessions[wallet].firstTx = Math.min(walletSessions[wallet].firstTx, tx.blockTimestamp);
      walletSessions[wallet].lastTx = Math.max(walletSessions[wallet].lastTx, tx.blockTimestamp);
      walletSessions[wallet].txCount++;
    });

    const sessionDurations = Object.values(walletSessions)
      .filter(session => session.txCount > 1)
      .map(session => session.lastTx - session.firstTx);

    return sessionDurations.length > 0 
      ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
      : 0;
  }

  /**
   * Calculate UX Bottlenecks from function signature analysis
   */
  calculateUXBottlenecks(transactions) {
    const functionFlows = {};
    const walletFlows = {};

    transactions.forEach(tx => {
      const wallet = tx.from;
      const funcSig = tx.input?.slice(0, 10) || '0x';
      
      if (!walletFlows[wallet]) walletFlows[wallet] = [];
      walletFlows[wallet].push({ funcSig, timestamp: tx.blockTimestamp, status: tx.status });
    });

    let bottlenecks = 0;
    Object.values(walletFlows).forEach(flow => {
      // Sort by timestamp
      flow.sort((a, b) => a.timestamp - b.timestamp);
      
      // Find incomplete flows (last transaction failed or abandoned)
      for (let i = 0; i < flow.length - 1; i++) {
        if (!flow[i].status || (flow[i + 1].timestamp - flow[i].timestamp > 3600)) {
          bottlenecks++;
        }
      }
    });

    return bottlenecks;
  }

  /**
   * Calculate User Retention
   */
  calculateUserRetention(transactions) {
    const now = Date.now() / 1000;
    const dayMs = 24 * 60 * 60;
    const weekMs = 7 * dayMs;
    
    const userFirstSeen = {};
    const userLastSeen = {};
    
    transactions.forEach(tx => {
      const user = tx.from;
      if (!userFirstSeen[user]) userFirstSeen[user] = tx.blockTimestamp;
      userLastSeen[user] = Math.max(userLastSeen[user] || 0, tx.blockTimestamp);
    });

    const totalUsers = Object.keys(userFirstSeen).length;
    const returningUsers = Object.keys(userFirstSeen).filter(user => {
      const daysSinceFirst = (userLastSeen[user] - userFirstSeen[user]) / dayMs;
      return daysSinceFirst >= 1; // Returned after at least 1 day
    }).length;

    return totalUsers > 0 ? (returningUsers / totalUsers) * 100 : 0;
  }

  /**
   * Calculate Protocol Revenue
   */
  calculateProtocolRevenue(transactions) {
    let totalInflow = 0;
    let totalOutflow = 0;
    let totalGasFees = 0;
    const ethToUsd = 2000;

    transactions.forEach(tx => {
      const valueWei = this.hexToDecimal(tx.value || '0x0');
      const valueUsd = (valueWei / 1e18) * ethToUsd;
      const gasUsed = this.hexToDecimal(tx.gasUsed || '0x0');
      const gasPrice = this.hexToDecimal(tx.gasPrice || '0x0');
      const gasFeeUsd = ((gasUsed * gasPrice) / 1e18) * ethToUsd;
      
      totalGasFees += gasFeeUsd;
      
      // Contract interactions
      if (tx.to && tx.to.toLowerCase() === process.env.CONTRACT_ADDRESS?.toLowerCase()) {
        totalInflow += valueUsd;
      }
      if (tx.from && tx.from.toLowerCase() === process.env.CONTRACT_ADDRESS?.toLowerCase()) {
        totalOutflow += valueUsd;
      }
    });

    // Revenue = Inflow - Outflow + Protocol fees (estimated as % of gas fees)
    const protocolFeeRate = parseFloat(process.env.PROTOCOL_FEE_RATE || '0.003'); // 0.3%
    return Math.max(0, totalInflow - totalOutflow + (totalGasFees * protocolFeeRate));
  }

  /**
   * Calculate Gas Efficiency
   */
  calculateGasEfficiency(transactions) {
    if (transactions.length === 0) return 0;

    const totalGasUsed = transactions.reduce((sum, tx) => 
      sum + this.hexToDecimal(tx.gasUsed || '0x0'), 0
    );
    const totalGasLimit = transactions.reduce((sum, tx) => 
      sum + this.hexToDecimal(tx.gasLimit || '0x0'), 0
    );

    return totalGasLimit > 0 ? (totalGasUsed / totalGasLimit) * 100 : 0;
  }

  /**
   * Calculate User Loyalty
   */
  calculateUserLoyalty(transactions) {
    const userTxCounts = {};
    transactions.forEach(tx => {
      userTxCounts[tx.from] = (userTxCounts[tx.from] || 0) + 1;
    });

    const totalUsers = Object.keys(userTxCounts).length;
    const loyalUsers = Object.values(userTxCounts).filter(count => count >= 5).length;
    
    return totalUsers > 0 ? (loyalUsers / totalUsers) * 100 : 0;
  }

  /**
   * Calculate Function Success Rate
   */
  calculateFunctionSuccessRate(transactions) {
    if (transactions.length === 0) return 0;
    
    const successfulTxs = transactions.filter(tx => tx.status === true).length;
    return (successfulTxs / transactions.length) * 100;
  }

  /**
   * Calculate Event Driven Volume
   */
  calculateEventDrivenVolume(transactions) {
    let eventVolume = 0;
    const eventCounts = {};

    transactions.forEach(tx => {
      if (tx.events) {
        tx.events.forEach(event => {
          const eventSig = event.topics?.[0] || 'unknown';
          eventCounts[eventSig] = (eventCounts[eventSig] || 0) + 1;
          
          // Calculate volume for transfer events (USDT = USD)
          if (eventSig === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
            const rawValue = this.hexToDecimal(event.data || '0x0');
            const transferValue = rawValue / 1e6;
            // Cap unreasonably large values
            eventVolume += Math.min(transferValue, 1000000);
          }
        });
      }
    });

    return { volume: eventVolume, mostCommonEvent: this.getMostCommonEvent(eventCounts) };
  }

  /**
   * Calculate User Journey Length from function signature interactions
   */
  calculateUserJourneyLength(transactions) {
    const userJourneys = {};
    
    transactions.forEach(tx => {
      const user = tx.from;
      const funcSig = tx.input?.slice(0, 10) || '0x';
      const timestamp = tx.blockTimestamp;
      
      if (!userJourneys[user]) {
        userJourneys[user] = [];
      }
      
      userJourneys[user].push({ funcSig, timestamp, status: tx.status });
    });

    let totalSteps = 0;
    let completedJourneys = 0;
    
    Object.values(userJourneys).forEach(journey => {
      // Sort by timestamp
      journey.sort((a, b) => a.timestamp - b.timestamp);
      
      // Count unique function signatures as journey steps
      const uniqueFunctions = new Set(journey.map(step => step.funcSig)).size;
      totalSteps += uniqueFunctions;
      
      // Journey is complete if last transaction was successful
      if (journey.length > 0 && journey[journey.length - 1].status) {
        completedJourneys++;
      }
    });

    const totalUsers = Object.keys(userJourneys).length;
    return {
      averageSteps: totalUsers > 0 ? totalSteps / totalUsers : 0,
      completionRate: totalUsers > 0 ? (completedJourneys / totalUsers) * 100 : 0
    };
  }
  calculateCrossChainUsers(transactions) {
    const bridgeSignatures = [
      '0xa9059cbb', // transfer
      '0x23b872dd', // transferFrom
      '0x095ea7b3'  // approve
    ];

    const crossChainUsers = new Set();
    transactions.forEach(tx => {
      const funcSig = tx.input?.slice(0, 10);
      if (bridgeSignatures.includes(funcSig)) {
        crossChainUsers.add(tx.from);
      }
    });

    return crossChainUsers.size;
  }

  /**
   * Helper functions
   */
  hexToDecimal(hex) {
    if (!hex || hex === '0x0' || hex === '0x') return 0;
    try {
      return parseInt(hex, 16);
    } catch (e) {
      return 0;
    }
  }

  getMostCommonEvent(eventCounts) {
    return Object.entries(eventCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';
  }

  /**
   * Calculate all overview metrics
   */
  calculateOverviewMetrics(transactions) {
    const volume = this.calculateTransactionVolume(transactions);
    const tvl = this.calculateTVL(transactions);
    const sessionDuration = this.calculateSessionDuration(transactions);
    const bottlenecks = this.calculateUXBottlenecks(transactions);
    const uxGrade = this.calculateUXGrade(transactions, sessionDuration, bottlenecks);
    const retention = this.calculateUserRetention(transactions);
    const revenue = this.calculateProtocolRevenue(transactions);
    const gasEfficiency = this.calculateGasEfficiency(transactions);
    const loyalty = this.calculateUserLoyalty(transactions);
    const successRate = this.calculateFunctionSuccessRate(transactions);
    const eventData = this.calculateEventDrivenVolume(transactions);
    const crossChainUsers = this.calculateCrossChainUsers(transactions);

    const uniqueUsers = new Set(transactions.map(tx => tx.from)).size;
    const dau = this.calculateDAU(transactions);

    return {
      totalTransactions: transactions.length,
      successRate: successRate.toFixed(1),
      uniqueUsers,
      tvl: tvl.toFixed(2),
      transactionVolume: volume.totalVolume.toFixed(2),
      volume24h: volume.volume24h.toFixed(2),
      uxGrade: `${uxGrade.grade}% (${uxGrade.letter})`,
      sessionDuration: Math.round(sessionDuration / 60), // Convert to minutes
      uxBottlenecks: bottlenecks,
      userRetention: retention.toFixed(1),
      dau,
      protocolRevenue: revenue.toFixed(4),
      gasEfficiency: gasEfficiency.toFixed(1),
      userLoyalty: loyalty.toFixed(1),
      functionSuccessRate: successRate.toFixed(1),
      eventDrivenVolume: eventData.volume.toFixed(2),
      crossChainUsers,
      mevExposure: this.calculateMEVExposure(transactions).toFixed(1)
    };
  }

  calculateDAU(transactions) {
    const now = Date.now() / 1000;
    const dayMs = 24 * 60 * 60;
    const last24h = transactions.filter(tx => (now - tx.blockTimestamp) <= dayMs);
    return new Set(last24h.map(tx => tx.from)).size;
  }

  calculateMEVExposure(transactions) {
    // Simple MEV exposure calculation based on transaction patterns
    const highValueTxs = transactions.filter(tx => 
      this.hexToDecimal(tx.value || '0x0') / 1e18 > 10
    ).length;
    return Math.min(100, (highValueTxs / Math.max(transactions.length, 1)) * 100);
  }
}

export { AdvancedMetricsCalculator };
