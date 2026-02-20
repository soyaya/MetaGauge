/**
 * Authentication middleware
 * Handles JWT token validation and user authentication with file storage
 */

import jwt from 'jsonwebtoken';
import { UserStorage } from '../database/fileStorage.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for user
 */
export function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    tier: user.tier
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Authentication middleware
 * Validates JWT token and attaches user to request
 */
export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        message: 'Please provide a valid access token in the Authorization header'
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    
    // Get user from file storage
    const user = await UserStorage.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'The user associated with this token no longer exists'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account deactivated',
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Attach user to request (without password)
    const { password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    next();

  } catch (error) {
    return res.status(401).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
}

/**
 * API Key authentication middleware
 * Alternative authentication method using API keys
 */
export async function authenticateApiKey(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Please provide a valid API key in the X-API-Key header'
      });
    }

    // Get user by API key from file storage
    const user = await UserStorage.findByApiKey(apiKey);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account deactivated',
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Attach user to request (without password)
    const { password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    next();

  } catch (error) {
    return res.status(401).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
}

/**
 * Authorization middleware for different user tiers
 */
export function requireTier(requiredTier) {
  const tierLevels = {
    'free': 1,
    'pro': 2,
    'enterprise': 3
  };

  return (req, res, next) => {
    const userTier = req.user?.tier || 'free';
    const userLevel = tierLevels[userTier] || 1;
    const requiredLevel = tierLevels[requiredTier] || 1;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This endpoint requires ${requiredTier} tier or higher. Your current tier: ${userTier}`,
        upgrade_url: '/api/users/upgrade'
      });
    }

    next();
  };
}

export default {
  generateToken,
  verifyToken,
  authenticateToken,
  authenticateApiKey,
  requireTier
};