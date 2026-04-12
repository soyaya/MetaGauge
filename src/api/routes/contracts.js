/**
 * Contract configuration routes
 * Handles CRUD operations for contract configurations with file storage
 * Uses TARGET and COMPETITOR data from .env file
 */

import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { ethers } from 'ethers';
import { ContractStorage, UserStorage } from '../database/index.js';
import * as CompetitorStorage from '../database/CompetitorStorage.js';
import { indexCompetitor, resumeCompetitorPolls, getCompetitorMetrics } from './competitor-indexing.js';
import { suggest as suggestCompetitors } from '../../services/CompetitorSuggestionEngine.js';
import { requireTier } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

dotenv.config();

/**
 * Validate contract exists on chain via RPC
 */
async function validateContractOnChain(address, chain, rpcUrls) {
  const urls = rpcUrls?.filter(Boolean) || [];
  if (!urls.length) return { valid: true, note: 'No RPC configured, skipping validation' };

  for (const url of urls) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      const code = await provider.getCode(address);
      if (code && code !== '0x') {
        return { valid: true };
      }
      return { valid: false, error: `Contract not found on ${chain}` };
    } catch {
      continue;
    }
  }
  return { valid: true, note: 'RPC validation failed, proceeding anyway' };
}

/**
 * Extract function signatures from ABI JSON string
 */
function extractFunctionSignatures(abiJson) {
  try {
    const abi = typeof abiJson === 'string' ? JSON.parse(abiJson) : abiJson;
    return abi
      .filter(item => item.type === 'function')
      .map(item => {
        const inputs = (item.inputs || []).map(i => i.type).join(',');
        return { name: item.name, signature: `${item.name}(${inputs})` };
      });
  } catch {
    return [];
  }
}

const router = express.Router();

// Load default configuration from .env
function getDefaultConfigFromEnv() {
  const targetContract = {
    address: process.env.CONTRACT_ADDRESS,
    chain: process.env.CONTRACT_CHAIN || 'ethereum',
    name: process.env.CONTRACT_NAME || 'Target Contract',
    abi: process.env.CONTRACT_ABI_PATH
  };

  const competitors = [];
  for (let i = 1; i <= 5; i++) {
    const address = process.env[`COMPETITOR_${i}_ADDRESS`];
    const chain = process.env[`COMPETITOR_${i}_CHAIN`];
    const name = process.env[`COMPETITOR_${i}_NAME`];
    const abi = process.env[`COMPETITOR_${i}_ABI_PATH`];
    
    if (address && chain) {
      competitors.push({ address, chain, name: name || `Competitor ${i}`, abi });
    }
  }

  const rpcConfig = {
    ethereum: [
      process.env.ETHEREUM_RPC_URL,
      process.env.ETHEREUM_RPC_URL_FALLBACK
    ].filter(Boolean),
    starknet: [
      process.env.STARKNET_RPC_URL1,
      process.env.STARKNET_RPC_URL2,
      process.env.STARKNET_RPC_URL3
    ].filter(Boolean)
  };

  return {
    targetContract,
    competitors,
    rpcConfig,
    analysisParams: {
      // Use smart search instead of fixed blockRange
      searchStrategy: 'standard',
      smartSearch: true,
      whaleThreshold: parseFloat(process.env.WHALE_THRESHOLD_ETH) || 10,
      maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 5,
      failoverTimeout: parseInt(process.env.FAILOVER_TIMEOUT) || 30000,
      maxRetries: parseInt(process.env.MAX_RETRIES) || 2,
      outputFormats: (process.env.OUTPUT_FORMATS || 'json,csv,markdown').split(',')
    }
  };
}

/**
 * @swagger
 * /api/contracts:
 *   get:
 *     summary: Get user's contract configurations
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: chain
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contract configurations retrieved successfully
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search, chain, tags } = req.query;
    const userId = req.user.id;

    // Build filters
    const filters = {};
    if (search) filters.search = search;
    if (chain) filters.chain = chain;
    if (tags) filters.tags = Array.isArray(tags) ? tags : [tags];

    // Get contracts from file storage
    const allContracts = await ContractStorage.findByUserId(userId, filters);

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const contracts = allContracts.slice(startIndex, endIndex);

    // Remove sensitive RPC data from response
    const sanitizedContracts = contracts.map(contract => {
      const { rpcConfig, ...contractWithoutRpc } = contract;
      return contractWithoutRpc;
    });

    res.json({
      contracts: sanitizedContracts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: allContracts.length,
        pages: Math.ceil(allContracts.length / limit)
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve contracts',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/contracts:
 *   post:
 *     summary: Create new contract configuration
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - targetContract
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the contract configuration
 *               description:
 *                 type: string
 *                 description: Optional description
 *               targetContract:
 *                 type: object
 *                 required:
 *                   - address
 *                   - chain
 *                   - name
 *                 properties:
 *                   address:
 *                     type: string
 *                     description: Contract address
 *                   chain:
 *                     type: string
 *                     description: Blockchain network
 *                   name:
 *                     type: string
 *                     description: Contract name
 *                   abi:
 *                     type: string
 *                     description: ABI JSON string or file path
 *               competitors:
 *                 type: array
 *                 description: Optional competitor contracts
 *                 items:
 *                   type: object
 *                   properties:
 *                     address:
 *                       type: string
 *                     chain:
 *                       type: string
 *                     name:
 *                       type: string
 *                     abi:
 *                       type: string
 *               analysisParams:
 *                 type: object
 *                 description: Optional analysis parameters (uses env defaults)
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Contract configuration created successfully
 *       400:
 *         description: Invalid input data or missing required fields
 */
router.post('/', requireRole('analyst'), async (req, res) => {
  try {
    const {
      name,
      description,
      targetContract,
      competitors = [],
      analysisParams = {},
      tags = []
    } = req.body;

    const userId = req.user.id;

    // Validation - name and targetContract are always required
    if (!name || !targetContract) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Name and targetContract are required'
      });
    }

    // Always use RPC config from environment variables
    const envRpcConfig = {
      ethereum: [
        process.env.ETHEREUM_RPC_URL,
        process.env.ETHEREUM_RPC_URL_FALLBACK
      ].filter(Boolean),
      starknet: [
        process.env.STARKNET_RPC_URL1,
        process.env.STARKNET_RPC_URL2,
        process.env.STARKNET_RPC_URL3
      ].filter(Boolean)
    };

    // Save ABI if provided
    let abiPath = targetContract.abi;
    let functionSignatures = [];

    if (targetContract.abi && targetContract.abi.startsWith('{')) {
      // Validate ABI format and extract function signatures
      try {
        functionSignatures = extractFunctionSignatures(targetContract.abi);
      } catch {
        return res.status(400).json({ error: 'Invalid ABI format', message: 'Could not parse ABI JSON' });
      }

      const abiFileName = `${targetContract.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
      abiPath = `./abis/${abiFileName}`;
      try {
        await fs.writeFile(abiPath, targetContract.abi, 'utf8');
      } catch (error) {
        console.error('Failed to save ABI:', error);
      }
    }

    // Validate contract exists on chain
    if (targetContract.address && targetContract.chain) {
      const rpcUrls = envRpcConfig[targetContract.chain] || [];
      const validation = await validateContractOnChain(targetContract.address, targetContract.chain, rpcUrls);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Contract not found', message: validation.error });
      }
    }

    // Process competitors and save their ABIs
    const processedCompetitors = await Promise.all(competitors.map(async (competitor) => {
      let competitorAbiPath = competitor.abi;
      
      if (competitor.abi && competitor.abi.startsWith('{')) {
        // If ABI is provided as JSON string, save it to file
        const competitorAbiFileName = `${competitor.name?.toLowerCase().replace(/\s+/g, '-') || 'competitor'}-${Date.now()}.json`;
        competitorAbiPath = `./abis/${competitorAbiFileName}`;
        
        try {
          await fs.writeFile(competitorAbiPath, competitor.abi, 'utf8');
          console.log(`✅ Competitor ABI saved to ${competitorAbiPath}`);
        } catch (error) {
          console.error('Failed to save competitor ABI:', error);
          // Continue with provided ABI path
        }
      }

      return {
        ...competitor,
        abi: competitorAbiPath
      };
    }));

    const configData = {
      name,
      description,
      targetContract: {
        ...targetContract,
        abi: abiPath,
        functionSignatures
      },
      competitors: processedCompetitors,
      rpcConfig: envRpcConfig, // Always use environment RPC config
      analysisParams: {
        // Use smart search instead of fixed blockRange
        searchStrategy: 'standard',
        smartSearch: true,
        whaleThreshold: parseFloat(process.env.WHALE_THRESHOLD_ETH) || 10,
        maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 5,
        failoverTimeout: parseInt(process.env.FAILOVER_TIMEOUT) || 30000,
        maxRetries: parseInt(process.env.MAX_RETRIES) || 2,
        outputFormats: (process.env.OUTPUT_FORMATS || 'json,csv,markdown').split(','),
        ...analysisParams
      },
      tags
    };

    // If a config with this name already exists, reuse it
    const existingConfigs = await ContractStorage.findByUserId(userId);
    const existingConfig = existingConfigs.find(config => config.name === configData.name);
    if (existingConfig) {
      return res.status(200).json({ id: existingConfig.id, ...existingConfig, reused: true });
    }

    // Create configuration
    const config = await ContractStorage.create({
      userId,
      ...configData
    });

    // Kick off per-user competitor indexing for each competitor (non-blocking)
    if (processedCompetitors.length > 0) {
      const crypto = await import('crypto');
      for (const comp of processedCompetitors) {
        if (!comp.address || !comp.chain) continue;
        const competitorId = crypto.randomUUID();
        setImmediate(() =>
          indexCompetitor(userId, {
            id: competitorId,
            address: comp.address,
            chain: comp.chain,
            name: comp.name || comp.address,
          }).catch(err => console.warn(`⚠️ Competitor indexing failed: ${err.message}`))
        );
      }
    }

    res.status(201).json({
      message: 'Contract configuration created successfully',
      id: config.id,
      ...config
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to create configuration',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/contracts/{id}:
 *   get:
 *     summary: Get contract configuration by ID
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contract configuration retrieved successfully
 *       404:
 *         description: Configuration not found
 */
router.get('/:id', async (req, res) => {
  try {
    const config = await ContractStorage.findById(req.params.id);

    if (!config || config.userId !== req.user.id || !config.isActive) {
      return res.status(404).json({
        error: 'Configuration not found',
        message: 'Contract configuration not found or access denied'
      });
    }

    res.json({ config });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve configuration',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/contracts/{id}:
 *   put:
 *     summary: Update contract configuration
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Configuration updated successfully
 *       404:
 *         description: Configuration not found
 */
router.put('/:id', requireRole('analyst'), async (req, res) => {
  try {
    const config = await ContractStorage.findById(req.params.id);

    if (!config || config.userId !== req.user.id || config.isActive === false) {
      return res.status(404).json({
        error: 'Configuration not found',
        message: 'Contract configuration not found or access denied'
      });
    }

    // Update fields
    const allowedUpdates = [
      'name', 'description', 'targetContract', 'competitors',
      'rpcConfig', 'analysisParams', 'tags'
    ];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedConfig = await ContractStorage.update(req.params.id, updates);

    res.json({
      message: 'Configuration updated successfully',
      config: updatedConfig
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to update configuration',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/contracts/{id}:
 *   delete:
 *     summary: Delete contract configuration
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Configuration deleted successfully
 *       404:
 *         description: Configuration not found
 */
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const config = await ContractStorage.findById(req.params.id);

    if (!config || config.userId !== req.user.id || config.isActive === false) {
      return res.status(404).json({
        error: 'Configuration not found',
        message: 'Contract configuration not found or access denied'
      });
    }

    // Soft delete
    await ContractStorage.delete(req.params.id);

    res.json({
      message: 'Configuration deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete configuration',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/contracts/{id}/duplicate:
 *   post:
 *     summary: Duplicate contract configuration
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Configuration duplicated successfully
 */
router.post('/:id/duplicate', async (req, res) => {
  try {
    const originalConfig = await ContractStorage.findById(req.params.id);

    if (!originalConfig || originalConfig.userId !== req.user.id || originalConfig.isActive === false) {
      return res.status(404).json({
        error: 'Configuration not found',
        message: 'Contract configuration not found or access denied'
      });
    }

    const { name } = req.body;
    if (!name) {
      return res.status(400).json({
        error: 'Name required',
        message: 'New configuration name is required'
      });
    }

    // Check if name already exists
    const userConfigs = await ContractStorage.findByUserId(req.user.id);
    const existingConfig = userConfigs.find(c => c.name === name && c.isActive !== false);

    if (existingConfig) {
      return res.status(400).json({
        error: 'Configuration exists',
        message: 'A configuration with this name already exists'
      });
    }

    // Create duplicate
    const duplicateConfig = await ContractStorage.create({
      userId: req.user.id,
      name,
      description: `Copy of ${originalConfig.description || originalConfig.name}`,
      targetContract: originalConfig.targetContract,
      competitors: originalConfig.competitors,
      rpcConfig: originalConfig.rpcConfig,
      analysisParams: originalConfig.analysisParams,
      tags: [...(originalConfig.tags || []), 'duplicate']
    });

    res.status(201).json({
      message: 'Configuration duplicated successfully',
      config: duplicateConfig
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to duplicate configuration',
      message: error.message
    });
  }
});

// Competitor comparison metrics for the current user
router.get('/my/competitor-metrics', async (req, res) => {
  try {
    const data = await getCompetitorMetrics(req.user.id);
    if (!data) return res.json({ competitors: [], user: null, updatedAt: null });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/competitor-suggestions', requireRole('viewer'), async (req, res) => {
  try {
    const contract = await ContractStorage.findById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    const allContracts = await ContractStorage.findByUserId(req.user.id);
    res.json({ suggestions: suggestCompetitors(contract, allContracts) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Task 7.1: Competitor CRUD
router.get('/:id/competitors', requireRole('viewer'), async (req, res) => {
  res.json({ competitors: CompetitorStorage.findByContractId(req.params.id) });
});

router.post('/:id/competitors', requireRole('analyst'), async (req, res) => {
  const { address, chain, name, group } = req.body;
  if (!address || !chain) return res.status(400).json({ error: 'address and chain required' });

  // Validate address format
  if (!/^0x[0-9a-fA-F]{40}$/.test(address) && chain !== 'starknet') {
    return res.status(400).json({ error: 'Invalid contract address format' });
  }

  const competitor = CompetitorStorage.create({ contractId: req.params.id, address, chain, name: name || address, group: group || null, addedBy: req.user.id });
  // Index this competitor per-user (non-blocking)
  const crypto = await import('crypto');
  setImmediate(() =>
    indexCompetitor(req.user.id, {
      id: crypto.randomUUID(),
      address, chain, name: name || address,
    }).catch(err => console.warn(`⚠️ Competitor indexing failed: ${err.message}`))
  );
  res.status(201).json({ competitor });
});

router.delete('/:id/competitors/:competitorId', requireRole('analyst'), async (req, res) => {
  const removed = CompetitorStorage.remove(req.params.competitorId, req.params.id);
  if (!removed) return res.status(404).json({ error: 'Competitor not found' });
  res.json({ message: 'Competitor removed' });
});

export default router;