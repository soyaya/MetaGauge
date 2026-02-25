/**
 * Cohort Calculator Service
 * Requirements: 5.1, 5.2, 5.3, 5.4, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3
 */

import { FunctionAnalyticsStorage } from './FunctionAnalyticsStorage.js';

export class CohortCalculatorService {
  constructor(storage = null) {
    this.storage = storage || new FunctionAnalyticsStorage();
  }

  /**
   * Group wallets into cohorts by first interaction date
   * Requirements: 5.1
   */
  groupIntoCohorts(interactions, cohortPeriod = 'monthly') {
    const walletFirstInteraction = new Map();
    
    // Find first interaction for each wallet
    for (const interaction of interactions) {
      const wallet = interaction.walletAddress;
      const timestamp = new Date(interaction.timestamp);
      
      if (!walletFirstInteraction.has(wallet) || timestamp < walletFirstInteraction.get(wallet)) {
        walletFirstInteraction.set(wallet, timestamp);
      }
    }

    // Group by cohort period
    const cohorts = new Map();
    
    for (const [wallet, firstInteraction] of walletFirstInteraction) {
      const cohortKey = this._getCohortKey(firstInteraction, cohortPeriod);
      
      if (!cohorts.has(cohortKey)) {
        cohorts.set(cohortKey, {
          cohortId: cohortKey,
          cohortDate: this._getCohortDate(firstInteraction, cohortPeriod),
          cohortPeriod,
          wallets: []
        });
      }
      
      cohorts.get(cohortKey).wallets.push(wallet);
    }

    return Array.from(cohorts.values());
  }

  /**
   * Calculate activation metrics
   * Requirements: 5.2, 7.1, 7.2, 7.3, 7.4
   */
  async calculateActivation(contractAddress, chain, signature = null, cohortPeriod = 'monthly', dateRange = null, activationConfig = null) {
    const config = activationConfig || { interactions: 2, days: 7 };
    const interactions = await this.storage.getInteractions(contractAddress, chain);
    
    // Filter by signature and date range
    let filtered = signature ? interactions.filter(i => i.signature === signature) : interactions;
    if (dateRange) {
      filtered = filtered.filter(i => {
        const ts = new Date(i.timestamp);
        return ts >= dateRange.start && ts <= dateRange.end;
      });
    }

    const cohorts = this.groupIntoCohorts(filtered, cohortPeriod);
    
    // Calculate activation for each cohort
    for (const cohort of cohorts) {
      const walletFirstInteraction = new Map();
      const walletInteractionCount = new Map();
      
      // Get first interaction and count for each wallet
      for (const interaction of filtered) {
        if (!cohort.wallets.includes(interaction.walletAddress)) continue;
        
        const wallet = interaction.walletAddress;
        const timestamp = new Date(interaction.timestamp);
        
        if (!walletFirstInteraction.has(wallet)) {
          walletFirstInteraction.set(wallet, timestamp);
        }
        
        const firstTs = walletFirstInteraction.get(wallet);
        const daysSinceFirst = (timestamp - firstTs) / (1000 * 60 * 60 * 24);
        
        if (daysSinceFirst <= config.days) {
          walletInteractionCount.set(wallet, (walletInteractionCount.get(wallet) || 0) + 1);
        }
      }
      
      // Count activated wallets
      let activatedCount = 0;
      for (const [wallet, count] of walletInteractionCount) {
        if (count >= config.interactions) {
          activatedCount++;
        }
      }
      
      cohort.walletCount = cohort.wallets.length;
      cohort.activationRate = cohort.walletCount > 0 ? activatedCount / cohort.walletCount : 0;
      delete cohort.wallets; // Remove wallet list from output
    }

    return cohorts;
  }

  /**
   * Calculate retention metrics
   * Requirements: 5.4, 9.1, 9.2, 9.3
   */
  async calculateRetention(contractAddress, chain, signature = null, cohortPeriod = 'monthly', dateRange = null) {
    const interactions = await this.storage.getInteractions(contractAddress, chain);
    
    // Filter by signature and date range
    let filtered = signature ? interactions.filter(i => i.signature === signature) : interactions;
    if (dateRange) {
      filtered = filtered.filter(i => {
        const ts = new Date(i.timestamp);
        return ts >= dateRange.start && ts <= dateRange.end;
      });
    }

    const cohorts = this.groupIntoCohorts(filtered, cohortPeriod);
    
    // Calculate retention for each cohort
    for (const cohort of cohorts) {
      const walletFirstInteraction = new Map();
      const walletLastInteraction = new Map();
      
      // Get first and last interaction for each wallet
      for (const interaction of filtered) {
        if (!cohort.wallets.includes(interaction.walletAddress)) continue;
        
        const wallet = interaction.walletAddress;
        const timestamp = new Date(interaction.timestamp);
        
        if (!walletFirstInteraction.has(wallet)) {
          walletFirstInteraction.set(wallet, timestamp);
        }
        
        if (!walletLastInteraction.has(wallet) || timestamp > walletLastInteraction.get(wallet)) {
          walletLastInteraction.set(wallet, timestamp);
        }
      }
      
      // Calculate retention at different intervals
      const retentionRates = {};
      const intervals = [1, 7, 30, 90];
      
      for (const days of intervals) {
        let retainedCount = 0;
        
        for (const wallet of cohort.wallets) {
          const firstTs = walletFirstInteraction.get(wallet);
          const lastTs = walletLastInteraction.get(wallet);
          
          if (!firstTs || !lastTs) continue;
          
          const daysSinceFirst = (lastTs - firstTs) / (1000 * 60 * 60 * 24);
          if (daysSinceFirst >= days) {
            retainedCount++;
          }
        }
        
        retentionRates[`day${days}`] = cohort.wallets.length > 0 ? retainedCount / cohort.wallets.length : 0;
      }
      
      cohort.walletCount = cohort.wallets.length;
      cohort.retentionRates = retentionRates;
      delete cohort.wallets;
    }

    return cohorts;
  }

  /**
   * Calculate churn metrics
   * Requirements: 5.3, 8.1, 8.2, 8.3, 8.4
   */
  async calculateChurn(contractAddress, chain, signature = null, cohortPeriod = 'monthly', dateRange = null, churnConfig = null) {
    const config = churnConfig || { inactiveDays: 30 };
    const interactions = await this.storage.getInteractions(contractAddress, chain);
    
    // Filter by signature and date range
    let filtered = signature ? interactions.filter(i => i.signature === signature) : interactions;
    if (dateRange) {
      filtered = filtered.filter(i => {
        const ts = new Date(i.timestamp);
        return ts >= dateRange.start && ts <= dateRange.end;
      });
    }

    const cohorts = this.groupIntoCohorts(filtered, cohortPeriod);
    const now = new Date();
    
    // Calculate churn for each cohort
    for (const cohort of cohorts) {
      const walletLastInteraction = new Map();
      
      // Get last interaction for each wallet
      for (const interaction of filtered) {
        if (!cohort.wallets.includes(interaction.walletAddress)) continue;
        
        const wallet = interaction.walletAddress;
        const timestamp = new Date(interaction.timestamp);
        
        if (!walletLastInteraction.has(wallet) || timestamp > walletLastInteraction.get(wallet)) {
          walletLastInteraction.set(wallet, timestamp);
        }
      }
      
      // Count churned wallets
      let churnedCount = 0;
      
      for (const wallet of cohort.wallets) {
        const lastTs = walletLastInteraction.get(wallet);
        if (!lastTs) continue;
        
        const daysSinceLast = (now - lastTs) / (1000 * 60 * 60 * 24);
        if (daysSinceLast >= config.inactiveDays) {
          churnedCount++;
        }
      }
      
      cohort.walletCount = cohort.wallets.length;
      cohort.churnRate = cohort.walletCount > 0 ? churnedCount / cohort.walletCount : 0;
      delete cohort.wallets;
    }

    return cohorts;
  }

  /**
   * Get cohort key based on period
   */
  _getCohortKey(date, period) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    if (period === 'daily') {
      return `${year}-${month}-${day}`;
    } else if (period === 'weekly') {
      const weekNum = this._getWeekNumber(d);
      return `${year}-W${String(weekNum).padStart(2, '0')}`;
    } else {
      return `${year}-${month}`;
    }
  }

  /**
   * Get cohort date (start of period)
   */
  _getCohortDate(date, period) {
    const d = new Date(date);
    
    if (period === 'daily') {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    } else if (period === 'weekly') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      return new Date(d.getFullYear(), d.getMonth(), diff);
    } else {
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
  }

  /**
   * Get ISO week number
   */
  _getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
}
