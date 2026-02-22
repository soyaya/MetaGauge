/**
 * Contract configuration routes
 * Handles CRUD operations for contract configurations with file storage
 * Uses TARGET and COMPETITOR data from .env file
 */

import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { ContractStorage } from '../database/index.js';
import { requireTier } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { contractSchemas } from '../middleware/validation.js';

dotenv.config();

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
    lisk: [
      process.env.LISK_RPC_URL1,
      process.env.LISK_RPC_URL2,
      process.env.LISK_RPC_URL3,
      process.env.LISK_RPC_URL4
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
router.post('/', validate(contractSchemas.create), async (req, res) => {
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

    // Check project limit
    const user = await UserStorage.findById(userId);
    const existingContracts = await ContractStorage.findByUserId(userId);
    const maxProjects = user.subscription?.features?.maxProjects || 1;
    
    if (existingContracts.length >= maxProjects) {
      return res.status(403).json({
        error: 'Project limit reached',
        message: `You have reached your limit of ${maxProjects} projects. Upgrade your plan to add more.`,
        currentCount: existingContracts.length,
        limit: maxProjects
      });
    }

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
      lisk: [
        process.env.LISK_RPC_URL1,
        process.env.LISK_RPC_URL2,
        process.env.LISK_RPC_URL3,
        process.env.LISK_RPC_URL4
      ].filter(Boolean),
      starknet: [
        process.env.STARKNET_RPC_URL1,
        process.env.STARKNET_RPC_URL2,
        process.env.STARKNET_RPC_URL3
      ].filter(Boolean)
    };

    // Save ABI if provided
    let abiPath = targetContract.abi;
    if (targetContract.abi && targetContract.abi.startsWith('{')) {
      // If ABI is provided as JSON string, save it to file
      const abiFileName = `${targetContract.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
      abiPath = `./abis/${abiFileName}`;
      
      try {
        await fs.writeFile(abiPath, targetContract.abi, 'utf8');
        console.log(`✅ ABI saved to ${abiPath}`);
      } catch (error) {
        console.error('Failed to save ABI:', error);
        // Continue with provided ABI path
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
        abi: abiPath
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

    // Check if name already exists for this user
    const existingConfigs = await ContractStorage.findByUserId(userId);
    const existingConfig = existingConfigs.find(config => config.name === configData.name);

    if (existingConfig) {
      return res.status(400).json({
        error: 'Configuration exists',
        message: 'A configuration with this name already exists'
      });
    }

    // Create configuration
    const config = await ContractStorage.create({
      userId,
      ...configData
    });

    res.status(201).json({
      message: 'Contract configuration created successfully',
      config
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
router.put('/:id', validate(contractSchemas.update), async (req, res) => {
  try {
    const config = await ContractConfig.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true
    });

    if (!config) {
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

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        config[field] = req.body[field];
      }
    });

    await config.save();

    res.json({
      message: 'Configuration updated successfully',
      config
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
router.delete('/:id', async (req, res) => {
  try {
    const config = await ContractConfig.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true
    });

    if (!config) {
      return res.status(404).json({
        error: 'Configuration not found',
        message: 'Contract configuration not found or access denied'
      });
    }

    // Soft delete
    config.isActive = false;
    await config.save();

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
    const originalConfig = await ContractConfig.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isActive: true
    });

    if (!originalConfig) {
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
    const existingConfig = await ContractConfig.findOne({
      userId: req.user._id,
      name: name,
      isActive: true
    });

    if (existingConfig) {
      return res.status(400).json({
        error: 'Configuration exists',
        message: 'A configuration with this name already exists'
      });
    }

    // Create duplicate
    const duplicateConfig = new ContractConfig({
      userId: req.user._id,
      name,
      description: `Copy of ${originalConfig.description || originalConfig.name}`,
      targetContract: originalConfig.targetContract,
      competitors: originalConfig.competitors,
      rpcConfig: originalConfig.rpcConfig,
      analysisParams: originalConfig.analysisParams,
      tags: [...originalConfig.tags, 'duplicate']
    });

    await duplicateConfig.save();

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

export default router;