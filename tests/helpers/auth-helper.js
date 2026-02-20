/**
 * AuthHelper Class
 * 
 * Simplifies authentication operations in tests.
 * Handles user registration, login, token generation, and cleanup.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserStorage } from '../../src/api/database/fileStorage.js';

export class AuthHelper {
  constructor() {
    this.testUsers = new Map(); // Track created test users for cleanup
  }

  /**
   * Register a new test user
   */
  async registerUser(userData = {}) {
    const defaultData = {
      email: global.testUtils.randomEmail(),
      password: 'TestPassword123!',
      name: 'Test User',
      ...userData,
    };

    // Hash password
    const hashedPassword = await bcrypt.hash(defaultData.password, 10);

    // Create user
    const user = await UserStorage.create({
      email: defaultData.email,
      password: hashedPassword,
      name: defaultData.name,
      tier: defaultData.tier || 'free',
      apiKey: this.generateApiKey(),
      isActive: true,
      onboarding: {
        completed: false,
      },
      usage: {
        analysisCount: 0,
        monthlyAnalysisCount: 0,
      },
      createdAt: new Date().toISOString(),
    });

    // Track for cleanup
    this.testUsers.set(user.id, { ...defaultData, hashedPassword });

    return {
      user,
      password: defaultData.password, // Return plain password for login tests
    };
  }

  /**
   * Login a user and get JWT token
   */
  async loginUser(credentials) {
    const { email, password } = credentials;

    // Find user
    const user = await UserStorage.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid password');
    }

    // Generate token
    const token = this.generateToken(user);

    return {
      user,
      token,
    };
  }

  /**
   * Generate JWT token for a user
   */
  generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      tier: user.tier,
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    });
  }

  /**
   * Get auth token for a user ID
   */
  async getAuthToken(userId) {
    const user = await UserStorage.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return this.generateToken(user);
  }

  /**
   * Create authenticated request headers
   */
  createAuthenticatedRequest(token) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Generate API key
   */
  generateApiKey() {
    return 'test_' + Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * Clean up a specific test user
   */
  async cleanupUser(userId) {
    try {
      await UserStorage.delete(userId);
      this.testUsers.delete(userId);
    } catch (error) {
      console.error(`Failed to cleanup user ${userId}:`, error.message);
    }
  }

  /**
   * Clean up all test users
   */
  async cleanupAllUsers() {
    const userIds = Array.from(this.testUsers.keys());
    
    for (const userId of userIds) {
      await this.cleanupUser(userId);
    }

    this.testUsers.clear();
  }

  /**
   * Create a user with specific tier
   */
  async createUserWithTier(tier) {
    return this.registerUser({ tier });
  }

  /**
   * Create a user with completed onboarding
   */
  async createOnboardedUser(contractData = {}) {
    const { user, password } = await this.registerUser();

    // Update user with onboarding data
    await UserStorage.update(user.id, {
      onboarding: {
        completed: true,
        defaultContract: {
          address: contractData.address || global.testUtils.randomAddress(),
          chain: contractData.chain || 'ethereum',
          name: contractData.name || 'Test Contract',
          ...contractData,
        },
      },
    });

    const updatedUser = await UserStorage.findById(user.id);
    return {
      user: updatedUser,
      password,
    };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Create expired token (for testing)
   */
  createExpiredToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      tier: user.tier,
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', {
      expiresIn: '-1h', // Expired 1 hour ago
    });
  }
}

// Export singleton instance
let authHelperInstance = null;

export function getAuthHelper() {
  if (!authHelperInstance) {
    authHelperInstance = new AuthHelper();
  }
  return authHelperInstance;
}
