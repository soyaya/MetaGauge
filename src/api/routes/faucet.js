/**
 * Faucet API Routes
 * Backend endpoints for MGT token faucet
 */

import express from 'express';
import { ethers } from 'ethers';
import getFaucetService from '../../services/FaucetService.js';

const router = express.Router();

/**
 * @swagger
 * /api/faucet/status/{address}:
 *   get:
 *     summary: Get faucet claim status for an address
 *     tags: [Faucet]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet address to check
 *     responses:
 *       200:
 *         description: Claim status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     address:
 *                       type: string
 *                     canClaim:
 *                       type: boolean
 *                     claimCheck:
 *                       type: object
 *                     history:
 *                       type: object
 *                     config:
 *                       type: object
 *       400:
 *         description: Invalid address
 *       500:
 *         description: Server error
 */
router.get('/status/:address', async (req, res) => {
  try {
    const { address } = req.params;

    // Validate address
    if (!address || typeof address !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address',
        code: 'INVALID_ADDRESS'
      });
    }

    const cleanAddress = address.trim();
    if (!cleanAddress.startsWith('0x') || cleanAddress.length !== 42) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format',
        code: 'INVALID_ADDRESS'
      });
    }

    // Additional validation using ethers
    try {
      ethers.getAddress(cleanAddress);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address checksum',
        code: 'INVALID_ADDRESS'
      });
    }

    const faucetService = getFaucetService();
    const status = faucetService.getClaimStatus(address);

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('Error getting faucet status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get faucet status',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/faucet/claim:
 *   post:
 *     summary: Claim MGT tokens from faucet
 *     tags: [Faucet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *             properties:
 *               address:
 *                 type: string
 *                 description: Recipient wallet address
 *               userAgent:
 *                 type: string
 *                 description: User agent for analytics
 *               ip:
 *                 type: string
 *                 description: IP address for rate limiting
 *     responses:
 *       200:
 *         description: Tokens claimed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactionHash:
 *                       type: string
 *                     recipient:
 *                       type: string
 *                     amount:
 *                       type: string
 *                     balanceAfter:
 *                       type: string
 *       400:
 *         description: Invalid request or claim not allowed
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Server error
 */
router.post('/claim', async (req, res) => {
  try {
    const { address, userAgent, ip } = req.body;

    // Validate required fields
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
        code: 'MISSING_ADDRESS'
      });
    }

    // Validate address format
    if (!address || typeof address !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format',
        code: 'INVALID_ADDRESS'
      });
    }

    const cleanAddress = address.trim();
    if (!cleanAddress.startsWith('0x') || cleanAddress.length !== 42) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format',
        code: 'INVALID_ADDRESS'
      });
    }

    // Additional validation using ethers
    try {
      ethers.getAddress(cleanAddress);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address checksum',
        code: 'INVALID_ADDRESS'
      });
    }

    // Get client IP for rate limiting
    const clientIP = ip || req.ip || req.connection.remoteAddress;

    // Prepare request info for logging
    const requestInfo = {
      userAgent: userAgent || req.get('User-Agent'),
      ip: clientIP,
      timestamp: new Date().toISOString(),
      headers: {
        origin: req.get('Origin'),
        referer: req.get('Referer')
      }
    };

    console.log(`🚰 Faucet claim request from ${address} (IP: ${clientIP})`);

    // Attempt to claim tokens
    const faucetService = getFaucetService();
    const result = await faucetService.claimTokens(address, requestInfo);

    if (!result.success) {
      // Handle different error types with appropriate status codes
      let statusCode = 400;
      
      if (result.error === 'COOLDOWN_ACTIVE') {
        statusCode = 429; // Too Many Requests
      } else if (result.error === 'RATE_LIMIT_EXCEEDED') {
        statusCode = 429;
      } else if (result.error === 'MAX_CLAIMS_REACHED') {
        statusCode = 403; // Forbidden
      }

      return res.status(statusCode).json({
        success: false,
        error: result.error,
        details: result.details,
        code: result.code || result.error
      });
    }

    // Success response
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error processing faucet claim:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process faucet claim',
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/faucet/stats:
 *   get:
 *     summary: Get faucet statistics
 *     tags: [Faucet]
 *     responses:
 *       200:
 *         description: Faucet statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalClaims:
 *                       type: number
 *                     totalUsers:
 *                       type: number
 *                     totalDistributed:
 *                       type: string
 *                     recentClaims24h:
 *                       type: number
 *                     faucetBalance:
 *                       type: string
 *                     config:
 *                       type: object
 *       500:
 *         description: Server error
 */
router.get('/stats', async (req, res) => {
  try {
    const faucetService = getFaucetService();
    const stats = await faucetService.getFaucetStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting faucet stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get faucet statistics',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/faucet/health:
 *   get:
 *     summary: Check faucet service health
 *     tags: [Faucet]
 *     responses:
 *       200:
 *         description: Faucet service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     faucetAddress:
 *                       type: string
 *                     tokenContract:
 *                       type: string
 *                     isOwner:
 *                       type: boolean
 *       500:
 *         description: Faucet service is unhealthy
 */
router.get('/health', async (req, res) => {
  try {
    const faucetService = getFaucetService();
    const health = await faucetService.initialize();

    res.json({
      success: true,
      data: {
        status: 'healthy',
        ...health
      }
    });

  } catch (error) {
    console.error('Faucet health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Faucet service is unhealthy',
      details: error.message,
      code: 'HEALTH_CHECK_FAILED'
    });
  }
});

/**
 * Rate limiting middleware for faucet endpoints
 */
const rateLimitMap = new Map();

const faucetRateLimit = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 10; // Max 10 requests per hour per IP

  // Clean old entries
  for (const [ip, requests] of rateLimitMap.entries()) {
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
    if (validRequests.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, validRequests);
    }
  }

  // Check current IP
  const requests = rateLimitMap.get(clientIP) || [];
  const recentRequests = requests.filter(timestamp => now - timestamp < windowMs);

  if (recentRequests.length >= maxRequests) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests from this IP',
      code: 'IP_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
    });
  }

  // Add current request
  recentRequests.push(now);
  rateLimitMap.set(clientIP, recentRequests);

  next();
};

// Apply rate limiting to claim endpoint
router.use('/claim', faucetRateLimit);

export default router;