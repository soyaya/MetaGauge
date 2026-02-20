#!/usr/bin/env node

/**
 * Multi-Chain Smart Contract Analytics Platform
 * CLI Entry Point
 */

import dotenv from 'dotenv';
import { AnalyticsEngine } from './index.js';

// Load environment variables
dotenv.config();

async function main() {
  try {
    console.log('🚀 Starting Multi-Chain Smart Contract Analytics...\n');

    // Get configuration from environment
    const config = {
      contractAddress: process.env.CONTRACT_ADDRESS,
      contractChain: process.env.CONTRACT_CHAIN || 'ethereum',
      contractName: process.env.CONTRACT_NAME || 'Target Contract',
      
      // Competitors
      competitors: []
    };

    // Load competitors from environment
    for (let i = 1; i <= 5; i++) {
      const address = process.env[`COMPETITOR_${i}_ADDRESS`];
      const chain = process.env[`COMPETITOR_${i}_CHAIN`];
      const name = process.env[`COMPETITOR_${i}_NAME`];
      
      if (address && chain && name) {
        config.competitors.push({
          id: `competitor-${i}`,
          address,
          chain,
          name
        });
      }
    }

    console.log(`📋 Configuration loaded:`);
    console.log(`   Target: ${config.contractName} (${config.contractAddress}) on ${config.contractChain}`);
    console.log(`   Competitors: ${config.competitors.length} configured\n`);

    // Initialize analytics engine
    const engine = new AnalyticsEngine(config);

    // Check command line arguments
    const args = process.argv.slice(2);
    const isCompetitorAnalysis = args.includes('--competitors');
    const isComparativeAnalysis = args.includes('--comparative');

    if (isCompetitorAnalysis) {
      console.log('🏆 Running Competitor Analysis...\n');
      
      for (const competitor of config.competitors) {
        console.log(`\n📊 Analyzing ${competitor.name}...`);
        try {
          const result = await engine.analyzeContract(
            competitor.address, 
            competitor.chain,
            competitor.name
          );
          console.log(`✅ ${competitor.name}: ${result.transactions} transactions analyzed`);
          console.log(`   DeFi Metrics: ${Object.keys(result.metrics).length} calculated`);
          console.log(`   User Behavior: ${result.behavior ? 'analyzed' : 'no data'}`);
        } catch (error) {
          console.error(`❌ Failed to analyze ${competitor.name}: ${error.message}`);
        }
      }
    } else if (isComparativeAnalysis) {
      console.log('📈 Running Comparative Analysis...\n');
      
      // Analyze target
      console.log(`📊 Analyzing target: ${config.contractName}...`);
      const targetResult = await engine.analyzeContract(
        config.contractAddress, 
        config.contractChain,
        config.contractName
      );
      
      // Analyze competitors
      const competitorResults = [];
      for (const competitor of config.competitors) {
        console.log(`📊 Analyzing competitor: ${competitor.name}...`);
        try {
          const result = await engine.analyzeContract(
            competitor.address, 
            competitor.chain,
            competitor.name
          );
          competitorResults.push({ ...competitor, result });
        } catch (error) {
          console.error(`❌ Failed to analyze ${competitor.name}: ${error.message}`);
        }
      }
      
      // Generate comparative report
      console.log('\n📋 Comparative Analysis Results:');
      console.log('=====================================');
      console.log(`Target (${config.contractName}): ${targetResult.transactions} transactions`);
      
      competitorResults.forEach(comp => {
        console.log(`${comp.name}: ${comp.result.transactions} transactions`);
      });
      
    } else {
      // Default: analyze target contract
      console.log(`📊 Analyzing target contract: ${config.contractName}...\n`);
      
      if (!config.contractAddress) {
        throw new Error('CONTRACT_ADDRESS not configured in .env file');
      }
      
      const result = await engine.analyzeContract(
        config.contractAddress, 
        config.contractChain,
        config.contractName
      );
      
      console.log('\n📋 Analysis Results:');
      console.log('==================');
      console.log(`Contract: ${result.contract}`);
      console.log(`Chain: ${result.chain}`);
      console.log(`Transactions: ${result.transactions}`);
      console.log(`DeFi Metrics: ${Object.keys(result.metrics).length} calculated`);
      console.log(`User Behavior: ${result.behavior ? 'analyzed' : 'no data'}`);
    }

    console.log('\n✅ Analysis complete!');
    
  } catch (error) {
    console.error('\n❌ Analysis failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle CLI arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🚀 Multi-Chain Smart Contract Analytics Platform

Usage:
  npm run analyze                    # Analyze target contract
  npm run analyze:competitors        # Analyze all competitors
  npm run analyze:comparative        # Comparative analysis

Configuration:
  Set CONTRACT_ADDRESS, CONTRACT_CHAIN, and COMPETITOR_*_* variables in .env file

Examples:
  npm run analyze                    # Basic analysis
  npm run analyze:competitors        # Competitor analysis
  npm run analyze:comparative        # Full comparative report
`);
  process.exit(0);
}

// Run main function
main().catch(console.error);