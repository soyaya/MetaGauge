/**
 * Authentication routes
 * Handles user registration, login, OAuth, and password management with file storage
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { UserStorage } from '../database/index.js';
import AbuseDetectionService from '../../services/AbuseDetectionService.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

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
router.post('/register', async (req, res) => {
  try {
    console.log('[AUTH] Registration request received:', { email: req.body.email, name: req.body.name });
    const { email, password, name } = req.body;

    // Input validation with specific error messages
    if (!email || !password || !name) {
      console.log('[AUTH] Validation failed: missing fields');
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Please fill in all fields',
        details: {
          email: !email ? 'Email is required' : null,
          password: !password ? 'Password is required' : null,
          name: !name ? 'Full name is required' : null
        }
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('[AUTH] Validation failed: invalid email format');
      return res.status(400).json({
        error: 'Invalid email format',
        message: 'Please enter a valid email address'
      });
    }

    // Password strength validation
    if (password.length < 6) {
      console.log('[AUTH] Validation failed: password too short');
      return res.status(400).json({
        error: 'Password too weak',
        message: 'Password must be at least 6 characters long'
      });
    }

    // Additional password requirements
    if (password.length > 128) {
      return res.status(400).json({
        error: 'Password too long',
        message: 'Password must be less than 128 characters'
      });
    }

    // Name validation
    if (name.trim().length < 2) {
      return res.status(400).json({
        error: 'Invalid name',
        message: 'Name must be at least 2 characters long'
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        error: 'Name too long',
        message: 'Name must be less than 100 characters'
      });
    }

    // Check if user already exists
    console.log('[AUTH] Checking if user exists...');
    const existingUser = await UserStorage.findByEmail(email.toLowerCase().trim());
    if (existingUser) {
      console.log('[AUTH] User already exists');
      return res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists. Try signing in instead.',
        suggestion: 'If you forgot your password, use the "Forgot Password" link on the login page.'
      });
    }

    // Abuse detection — disposable email, device fingerprint, domain velocity
    const abuseCheck = AbuseDetectionService.checkRegistration(req, email);
    if (!abuseCheck.allowed) {
      return res.status(403).json({ error: 'Registration blocked', message: abuseCheck.reason });
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
      role: 'admin',
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
router.post('/login', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      res.status(400);
      return res.end(JSON.stringify({
        error: 'Missing credentials',
        message: 'Please enter both email and password',
        details: {
          email: !email ? 'Email is required' : null,
          password: !password ? 'Password is required' : null
        }
      }));
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400);
      return res.end(JSON.stringify({
        error: 'Invalid email format',
        message: 'Please enter a valid email address'
      }));
    }

    // Find user
    const user = await UserStorage.findByEmail(email.toLowerCase().trim());
    if (!user) {
      res.status(401);
      return res.end(JSON.stringify({
        error: 'Invalid credentials',
        message: 'No account found with this email address',
        suggestion: 'Check your email or create a new account'
      }));
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401);
      return res.end(JSON.stringify({
        error: 'Invalid credentials',
        message: 'Incorrect password',
        suggestion: 'Check your password or use "Forgot Password" to reset it'
      }));
    }

    // Check if account is active
    if (!user.isActive) {
      res.status(403);
      return res.end(JSON.stringify({
        error: 'Account deactivated',
        message: 'Your account has been deactivated. Please contact support.',
        suggestion: 'Contact support to reactivate your account'
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
        lastLogin: new Date().toISOString(),
        emailVerified: !!(user.emailVerified || user.is_verified),
        is_verified: !!(user.emailVerified || user.is_verified),
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
    if (!accessToken) return res.status(400).json({ message: 'Google access token is required' });

    const googleResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
    if (!googleResponse.ok) return res.status(401).json({ message: 'Invalid Google token' });

    const googleUser = await googleResponse.json();

    // Find existing user by email or create new one
    let user = await UserStorage.findByEmail(googleUser.email);

    if (user) {
      // Mark as verified and update avatar
      await UserStorage.update(user.id, {
        emailVerified: true,
        is_verified: true,
        avatar: googleUser.picture,
        lastLogin: new Date().toISOString(),
        oauthProvider: 'google',
        oauthId: googleUser.id,
      });
      user = await UserStorage.findById(user.id);
    } else {
      // Create new user
      user = await UserStorage.create({
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
        password: crypto.randomBytes(32).toString('hex'), // unusable password
        tier: 'free',
        apiKey: crypto.randomBytes(32).toString('hex'),
        isActive: true,
        emailVerified: true,
        is_verified: true,
        oauthProvider: 'google',
        oauthId: googleUser.id,
        usage: { analysisCount: 0, monthlyAnalysisCount: 0, lastAnalysis: null, monthlyResetDate: new Date().toISOString() },
      });
    }

    const token = generateToken(user);
    res.json({
      message: 'Google login successful',
      user: { id: user.id, email: user.email, name: user.name, tier: user.tier, is_verified: true, avatar: user.avatar },
      token,
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({ message: error.message });
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
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const user = await UserStorage.findByEmail(email);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = Date.now() + 3600000; // 1 hour
      await UserStorage.update(user.id, { resetToken: token, resetTokenExpiry: expiry });

      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px">
          <h2 style="color:#3730a3;margin-top:0">Reset your MetaGauge password</h2>
          <p style="color:#374151">Click the button below to set a new password. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:linear-gradient(135deg,#4338ca,#7c3aed);color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Reset Password</a>
          <p style="color:#6b7280;font-size:13px">If you didn't request this, ignore this email. Your password won't change.</p>
        </div>`;

      let sent = false;
      if (process.env.RESEND_API_KEY) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: process.env.ALERT_FROM_EMAIL || 'noreply@metagauge.io', to: [user.email], subject: 'Reset your MetaGauge password', html }),
          });
          sent = true;
        } catch (e) { console.warn('[AUTH] Resend failed:', e.message); }
      }

      if (!sent && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          const nodemailerPkg = await import('nodemailer');
          const nodemailer = nodemailerPkg.default || nodemailerPkg;
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          });
          await transporter.sendMail({
            from: `"MetaGauge" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
            to: user.email,
            subject: 'Reset your MetaGauge password',
            html,
          });
          sent = true;
          console.log(`[AUTH] Password reset email sent via SMTP to ${user.email}`);
        } catch (e) { console.error('[AUTH] SMTP reset email failed:', e.message); }
      }

      if (!sent) console.log(`[AUTH] Reset link (no email provider): ${resetUrl}`);
    }
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    res.status(500).json({ message: 'Request failed' });
  }
});

// Reset password — validates token and sets new password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: 'Token and password are required' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

  try {
    const users = await UserStorage.findAll();
    const user = users.find(u => u.resetToken === token && u.resetTokenExpiry > Date.now());
    if (!user) return res.status(400).json({ message: 'Invalid or expired reset token' });

    const hashedPassword = await bcrypt.hash(password, 6);
    await UserStorage.update(user.id, { password: hashedPassword, resetToken: null, resetTokenExpiry: null });
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Reset failed' });
  }
});

// Send email verification OTP
router.post('/send-verification', authenticateToken, async (req, res) => {
  try {
    const user = await UserStorage.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.emailVerified || user.is_verified) return res.status(400).json({ message: 'Email already verified' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    const expiry = Date.now() + 15 * 60 * 1000; // 15 min
    await UserStorage.update(user.id, { verifyOtp: otp, verifyOtpExpiry: expiry });

    console.log(`[AUTH] Verification OTP for ${user.email}: ${otp}`);

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:12px">
        <h2 style="color:#3730a3;margin-top:0">Verify your MetaGauge account</h2>
        <p style="color:#374151">Enter this code to complete your sign up:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#1e1b4b;background:#fff;border:2px solid #e0e7ff;border-radius:8px;padding:16px 24px;text-align:center;margin:24px 0">${otp}</div>
        <p style="color:#6b7280;font-size:14px">Expires in 15 minutes. If you didn't sign up, ignore this email.</p>
      </div>`;

    let sent = false;

    // Try Resend first
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.ALERT_FROM_EMAIL || 'noreply@metagauge.io',
            to: [user.email],
            subject: 'Your MetaGauge verification code',
            html,
          }),
        });
        sent = true;
      } catch (e) {
        console.warn('[AUTH] Resend failed, falling back to SMTP:', e.message);
      }
    }

    // Fall back to SMTP (nodemailer)
    if (!sent && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const nodemailerPkg = await import('nodemailer');
        const nodemailer = nodemailerPkg.default || nodemailerPkg;
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT) || 587,
          secure: false,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        await transporter.sendMail({
          from: `"MetaGauge" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
          to: user.email,
          subject: 'Your MetaGauge verification code',
          html,
        });
        sent = true;
        console.log(`[AUTH] OTP sent via SMTP to ${user.email}`);
      } catch (e) {
        console.error('[AUTH] SMTP send failed:', e.message);
      }
    }

    const isDev = process.env.NODE_ENV !== 'production';
    res.json({
      message: sent ? 'Verification code sent to your email' : `Dev mode — no email provider configured`,
      ...((!sent || isDev) ? { devOtp: otp } : {}),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

  try {
    const user = await UserStorage.findByEmail(email);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.emailVerified || user.is_verified) return res.status(400).json({ message: 'Email already verified' });
    if (!user.verifyOtp || user.verifyOtp !== otp) return res.status(400).json({ message: 'Invalid verification code' });
    if (user.verifyOtpExpiry < Date.now()) return res.status(400).json({ message: 'Verification code expired' });

    await UserStorage.update(user.id, { emailVerified: true, is_verified: true, verifyOtp: null, verifyOtpExpiry: null });
    const updatedUser = await UserStorage.findById(user.id);
    const token = generateToken(updatedUser);

    res.json({ message: 'Email verified successfully', token, user: { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name, is_verified: true, emailVerified: true } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});