/**
 * Journey Analyzer Service
 * Requirements: 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 6.3, 6.5
 */

import { FunctionAnalyticsStorage } from './FunctionAnalyticsStorage.js';
import { functionDecoder } from './FunctionSignatureDecoder.js';

export class JourneyAnalyzerService {
  constructor(storage = null) {
    this.storage = storage || new FunctionAnalyticsStorage();
  }

  /**
   * Build user journey for a wallet
   * Requirements: 4.1, 4.2, 4.3, 4.4
   */
  async buildWalletJourney(walletAddress, contractAddress, chain, dateRange = null) {
    const interactions = await this.storage.getInteractions(contractAddress, chain);
    
    // Filter by wallet and date range
    let walletInteractions = interactions.filter(i => i.walletAddress === walletAddress);
    
    if (dateRange) {
      walletInteractions = walletInteractions.filter(i => {
        const ts = new Date(i.timestamp);
        return ts >= dateRange.start && ts <= dateRange.end;
      });
    }

    if (walletInteractions.length === 0) {
      return null;
    }

    // Sort by timestamp (Requirement 4.2)
    walletInteractions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const entryPoint = walletInteractions[0].signature;
    const lastInteraction = new Date(walletInteractions[walletInteractions.length - 1].timestamp);
    const uniqueSignatures = new Set(walletInteractions.map(i => i.signature)).size;

    // Check for gaps (missing data)
    const hasGaps = this._detectGaps(walletInteractions);

    return {
      walletAddress,
      interactions: walletInteractions,
      entryPoint,
      lastInteraction,
      totalInteractions: walletInteractions.length,
      uniqueSignatures,
      hasGaps
    };
  }

  /**
   * Get all journeys for a contract
   * Requirements: 4.1, 4.2, 4.3
   */
  async getContractJourneys(contractAddress, chain, dateRange = null) {
    const interactions = await this.storage.getInteractions(contractAddress, chain);
    
    // Group by wallet
    const walletMap = new Map();
    for (const interaction of interactions) {
      if (!walletMap.has(interaction.walletAddress)) {
        walletMap.set(interaction.walletAddress, []);
      }
      walletMap.get(interaction.walletAddress).push(interaction);
    }

    // Build journey for each wallet
    const journeys = [];
    for (const [walletAddress, _] of walletMap) {
      const journey = await this.buildWalletJourney(walletAddress, contractAddress, chain, dateRange);
      if (journey) {
        journeys.push(journey);
      }
    }

    return journeys;
  }

  /**
   * Generate flow visualization data
   * Requirements: 6.1, 6.2, 6.3, 6.5
   */
  async generateFlowVisualization(contractAddress, chain, dateRange = null, focusSignature = null) {
    const journeys = await this.getContractJourneys(contractAddress, chain, dateRange);
    
    // Filter journeys if focus signature provided
    const filteredJourneys = focusSignature
      ? journeys.filter(j => j.interactions.some(i => i.signature === focusSignature))
      : journeys;

    // Build nodes (signatures)
    const nodeMap = new Map();
    const edgeMap = new Map();
    const entryPoints = new Set();
    const dropOffs = new Set();

    for (const journey of filteredJourneys) {
      const interactions = journey.interactions;
      
      // Track entry point
      if (interactions.length > 0) {
        entryPoints.add(interactions[0].signature);
      }

      // Track drop-off (last interaction)
      if (interactions.length > 0) {
        dropOffs.add(interactions[interactions.length - 1].signature);
      }

      // Build nodes and edges
      for (let i = 0; i < interactions.length; i++) {
        const signature = interactions[i].signature;
        
        // Add to node map
        if (!nodeMap.has(signature)) {
          nodeMap.set(signature, new Set());
        }
        nodeMap.get(signature).add(journey.walletAddress);

        // Add edge if not last interaction
        if (i < interactions.length - 1) {
          const nextSignature = interactions[i + 1].signature;
          const edgeKey = `${signature}->${nextSignature}`;
          
          if (!edgeMap.has(edgeKey)) {
            edgeMap.set(edgeKey, new Set());
          }
          edgeMap.get(edgeKey).add(journey.walletAddress);
        }
      }
    }

    // Convert to node array
    const nodes = Array.from(nodeMap.entries()).map(([signature, wallets]) => ({
      id: signature,
      signature,
      name: functionDecoder.decode(signature, contractAddress),
      walletCount: wallets.size,
      isEntryPoint: entryPoints.has(signature),
      isDropOff: dropOffs.has(signature)
    }));

    // Convert to edge array
    const edges = Array.from(edgeMap.entries()).map(([edgeKey, wallets]) => {
      const [source, target] = edgeKey.split('->');
      const sourceWallets = nodeMap.get(source).size;
      
      return {
        source,
        target,
        walletCount: wallets.size,
        transitionRate: wallets.size / sourceWallets
      };
    });

    return { nodes, edges };
  }

  /**
   * Identify journey patterns
   * Requirements: 6.1, 6.5
   */
  async identifyJourneyPatterns(contractAddress, chain, dateRange = null) {
    const journeys = await this.getContractJourneys(contractAddress, chain, dateRange);
    
    const entryPoints = new Map();
    const dropOffs = new Map();
    const pathCounts = new Map();

    for (const journey of journeys) {
      if (journey.interactions.length === 0) continue;

      // Track entry points
      const entry = journey.interactions[0].signature;
      entryPoints.set(entry, (entryPoints.get(entry) || 0) + 1);

      // Track drop-offs
      const dropOff = journey.interactions[journey.interactions.length - 1].signature;
      dropOffs.set(dropOff, (dropOffs.get(dropOff) || 0) + 1);

      // Track paths
      const path = journey.interactions.map(i => i.signature).join('->');
      pathCounts.set(path, (pathCounts.get(path) || 0) + 1);
    }

    // Get top entry points
    const topEntryPoints = Array.from(entryPoints.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sig]) => sig);

    // Get top drop-offs
    const topDropOffs = Array.from(dropOffs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sig]) => sig);

    // Get common paths
    const commonPaths = Array.from(pathCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path]) => path.split('->'));

    return {
      entryPoints: topEntryPoints,
      dropOffs: topDropOffs,
      commonPaths
    };
  }

  /**
   * Detect gaps in journey data
   * Private helper method
   */
  _detectGaps(interactions) {
    // Simple gap detection: check for large time gaps between interactions
    if (interactions.length < 2) return false;

    const ONE_DAY = 24 * 60 * 60 * 1000;
    const MAX_GAP = 30 * ONE_DAY; // 30 days

    for (let i = 1; i < interactions.length; i++) {
      const timeDiff = new Date(interactions[i].timestamp) - new Date(interactions[i - 1].timestamp);
      if (timeDiff > MAX_GAP) {
        return true;
      }
    }

    return false;
  }
}
