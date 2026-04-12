/**
 * BenchmarkingService - Category benchmarks and percentile rankings
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';

const BENCHMARKS_FILE = './data/category_benchmarks.json';

function readBenchmarks() {
  if (!existsSync(BENCHMARKS_FILE)) return {};
  try { return JSON.parse(readFileSync(BENCHMARKS_FILE, 'utf8')); } catch { return {}; }
}

function writeBenchmarks(benchmarks) {
  writeFileSync(BENCHMARKS_FILE, JSON.stringify(benchmarks, null, 2), 'utf8');
}

export class BenchmarkingService {
  constructor() {
    this.categories = ['DeFi', 'NFT', 'DAO', 'Gaming', 'Infrastructure'];
    this.metrics = ['d7Retention', 'churnRate', 'rpaw', 'activeWallets', 'monthlyRevenue'];
  }

  async recalculateAll() {
    const benchmarks = {};
    
    for (const category of this.categories) {
      benchmarks[category] = await this.calculateCategory(category);
    }
    
    writeBenchmarks(benchmarks);
    console.log('Benchmarks recalculated for all categories');
  }

  async calculateCategory(category) {
    const contracts = await this.getContractsByCategory(category);
    
    if (contracts.length < 3) {
      console.log(`Skipping ${category}: insufficient contracts (${contracts.length} < 3)`);
      return null;
    }

    const benchmarks = {};
    
    for (const metric of this.metrics) {
      const values = contracts
        .map(c => c.metrics?.[metric])
        .filter(v => v !== undefined && v !== null && !isNaN(v))
        .sort((a, b) => a - b);
      
      if (values.length === 0) continue;
      
      benchmarks[metric] = {
        avg: values.reduce((sum, v) => sum + v, 0) / values.length,
        p25: this.percentile(values, 0.25),
        p50: this.percentile(values, 0.50),
        p75: this.percentile(values, 0.75),
        p90: this.percentile(values, 0.90),
        min: values[0],
        max: values[values.length - 1],
        count: values.length
      };
    }
    
    return benchmarks;
  }

  percentile(sortedArray, p) {
    if (sortedArray.length === 0) return 0;
    const index = (sortedArray.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1];
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  getPercentileRank(value, benchmarks, metric) {
    if (!benchmarks[metric]) return null;
    
    const { p25, p50, p75, p90, min, max } = benchmarks[metric];
    
    if (value <= min) return 0;
    if (value >= max) return 100;
    if (value <= p25) return 25 * (value - min) / (p25 - min);
    if (value <= p50) return 25 + 25 * (value - p25) / (p50 - p25);
    if (value <= p75) return 50 + 25 * (value - p50) / (p75 - p50);
    if (value <= p90) return 75 + 15 * (value - p75) / (p90 - p75);
    return 90 + 10 * (value - p90) / (max - p90);
  }

  async getContractsByCategory(category) {
    // Mock contract data - in real implementation, fetch from database
    const mockContracts = {
      DeFi: [
        { id: '1', metrics: { d7Retention: 45, churnRate: 25, rpaw: 150, activeWallets: 1200 } },
        { id: '2', metrics: { d7Retention: 52, churnRate: 22, rpaw: 180, activeWallets: 800 } },
        { id: '3', metrics: { d7Retention: 38, churnRate: 30, rpaw: 120, activeWallets: 1500 } },
        { id: '4', metrics: { d7Retention: 60, churnRate: 18, rpaw: 220, activeWallets: 600 } }
      ],
      NFT: [
        { id: '5', metrics: { d7Retention: 35, churnRate: 35, rpaw: 80, activeWallets: 2000 } },
        { id: '6', metrics: { d7Retention: 42, churnRate: 28, rpaw: 95, activeWallets: 1800 } },
        { id: '7', metrics: { d7Retention: 28, churnRate: 40, rpaw: 65, activeWallets: 2200 } }
      ]
    };
    
    return mockContracts[category] || [];
  }

  getBenchmarks(category) {
    const benchmarks = readBenchmarks();
    return benchmarks[category] || null;
  }
}
