/**
 * Authentication routes
 * Handles user registration, login, OAuth, and password management with file storage
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { UserStorage } from '../database/index.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authSchemas } from '../middleware/validation.js';

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input or user already exists
 */
router.post('/register', validate(authSchemas.register), async (req, res) => {
  try {
    console.log('[AUTH] Registration request received:', { email: req.body.email, name: req.body.name });
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      console.log('[AUTH] Validation failed: missing fields');
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email, password, and name are required'
      });
    }

    if (password.length < 6) {
      console.log('[AUTH] Validation failed: password too short');
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    console.log('[AUTH] Checking if user exists...');
    const existingUser = await UserStorage.findByEmail(email);
    if (existingUser) {
      console.log('[AUTH] User already exists');
      return res.status(400).json({
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }

    // Hash password (6 rounds for faster response on WSL)
    console.log('[AUTH] Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 6);
    console.log('[AUTH] Password hashed successfully');

    // Create user
    console.log('[AUTH] Creating user...');
    const userData = {
      email,
      password: hashedPassword,
      name,
      tier: 'free',
      apiKey: crypto.randomBytes(32).toString('hex'),
      isActive: true,
      emailVerified: false,
      usage: {
        analysisCount: 0,
        monthlyAnalysisCount: 0,
        lastAnalysis: null,
        monthlyResetDate: new Date().toISOString()
      },
      onboarding: {
        completed: false,
        socialLinks: {
          website: null,
          twitter: null,
          discord: null,
          telegram: null
        },
        logo: null,
        defaultContract: {
          address: null,
          chain: null,
          abi: null,
          name: null,
          purpose: null,
          category: null,
          startDate: null,
          isIndexed: false,
          indexingProgress: 0,
          lastAnalysisId: null
        }
      },
      preferences: {
        notifications: {
          email: true,
          analysis: true
        },
        defaultChain: 'ethereum'
      }
    };

    console.log('[AUTH] Saving user to storage...');
    const user = await UserStorage.create(userData);
    console.log('[AUTH] User created successfully:', user.id);

    // Generate JWT token
    console.log('[AUTH] Generating JWT token...');
    const token = generateToken(user);
    console.log('[AUTH] Token generated');

    console.log('[AUTH] Sending response...');
    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        apiKey: user.apiKey
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', validate(authSchemas.login), async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      return res.end(JSON.stringify({
        error: 'Missing credentials',
        message: 'Email and password are required'
      }));
    }

    // Find user
    const user = await UserStorage.findByEmail(email);
    if (!user) {
      res.status(401);
      return res.end(JSON.stringify({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      }));
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401);
      return res.end(JSON.stringify({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      }));
    }

    if (!user.isActive) {
      res.status(401);
      return res.end(JSON.stringify({
        error: 'Account deactivated',
        message: 'Your account has been deactivated. Please contact support.'
      }));
    }

    // Update last login
    await UserStorage.update(user.id, { lastLogin: new Date().toISOString() });

    // Generate token
    const token = generateToken(user);

    // Create clean response with only primitive values
    const response = {
      message: 'Login successful',
      user: {
        id: String(user.id),
        email: String(user.email),
        name: String(user.name),
        tier: String(user.tier),
        apiKey: String(user.apiKey),
        lastLogin: new Date().toISOString()
      },
      token: String(token)
    };

    res.status(200);
    return res.end(JSON.stringify(response));

  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    res.status(500);
    return res.end(JSON.stringify({
      error: 'Login failed',
      message: 'Internal server error'
    }));
  }
});

/**
 * @swagger
 * /api/auth/oauth/google:
 *   post:
 *     summary: Google OAuth login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accessToken
 *             properties:
 *               accessToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: OAuth login successful
 *       401:
 *         description: Invalid token
 */
router.post('/oauth/google', async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        error: 'Missing access token',
        message: 'Google access token is required'
      });
    }

    // Verify Google token
    const googleResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
    
    if (!googleResponse.ok) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Google access token is invalid'
      });
    }

    const googleUser = await googleResponse.json();

    // Find or create user
    let user = await User.findOne({
      $or: [
        { email: googleUser.email },
        { oauthProvider: 'google', oauthId: googleUser.id }
      ]
    });

    if (user) {
      // Update existing user
      user.oauthProvider = 'google';
      user.oauthId = googleUser.id;
      user.avatar = googleUser.picture;
      user.lastLogin = new Date();
      user.emailVerified = true;
    } else {
      // Create new user
      user = new User({
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
        oauthProvider: 'google',
        oauthId: googleUser.id,
        emailVerified: true,
        lastLogin: new Date()
      });
      user.generateApiKey();
    }

    await user.save();

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'OAuth login successful',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        tier: user.tier,
        apiKey: user.apiKey,
        oauthProvider: user.oauthProvider
      },
      token
    });

  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({
      error: 'OAuth login failed',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/auth/oauth/github:
 *   post:
 *     summary: GitHub OAuth login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accessToken
 *             properties:
 *               accessToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: OAuth login successful
 *       401:
 *         description: Invalid token
 */
router.post('/oauth/github', async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        error: 'Missing access token',
        message: 'GitHub access token is required'
      });
    }

    // Verify GitHub token
    const githubResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'User-Agent': 'Analytics-API'
      }
    });

    if (!githubResponse.ok) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'GitHub access token is invalid'
      });
    }

    const githubUser = await githubResponse.json();

    // Get user email if not public
    let email = githubUser.email;
    if (!email) {
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `token ${accessToken}`,
          'User-Agent': 'Analytics-API'
        }
      });
      
      if (emailResponse.ok) {
        const emails = await emailResponse.json();
        const primaryEmail = emails.find(e => e.primary);
        email = primaryEmail ? primaryEmail.email : null;
      }
    }

    if (!email) {
      return res.status(400).json({
        error: 'Email required',
        message: 'Unable to retrieve email from GitHub account'
      });
    }

    // Find or create user
    let user = await User.findOne({
      $or: [
        { email: email },
        { oauthProvider: 'github', oauthId: githubUser.id.toString() }
      ]
    });

    if (user) {
      // Update existing user
      user.oauthProvider = 'github';
      user.oauthId = githubUser.id.toString();
      user.avatar = githubUser.avatar_url;
      user.lastLogin = new Date();
      user.emailVerified = true;
    } else {
      // Create new user
      user = new User({
        email: email,
        name: githubUser.name || githubUser.login,
        avatar: githubUser.avatar_url,
        oauthProvider: 'github',
        oauthId: githubUser.id.toString(),
        emailVerified: true,
        lastLogin: new Date()
      });
      user.generateApiKey();
    }

    await user.save();

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'OAuth login successful',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        tier: user.tier,
        apiKey: user.apiKey,
        oauthProvider: user.oauthProvider
      },
      token
    });

  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.status(500).json({
      error: 'OAuth login failed',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    const { password, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get user profile',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/auth/refresh-api-key:
 *   post:
 *     summary: Generate new API key
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: API key refreshed successfully
 */
router.post('/refresh-api-key', authenticateToken, async (req, res) => {
  try {
    const newApiKey = crypto.randomBytes(32).toString('hex');
    await UserStorage.update(req.user.id, { apiKey: newApiKey });

    res.json({
      message: 'API key refreshed successfully',
      apiKey: newApiKey
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to refresh API key',
      message: error.message
    });
  }
});

export default router;