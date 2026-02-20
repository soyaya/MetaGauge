/**
 * User model for MongoDB
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return !this.oauthProvider; // Password required only if not OAuth user
    }
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  avatar: {
    type: String,
    default: null
  },
  oauthProvider: {
    type: String,
    enum: ['google', 'github', null],
    default: null
  },
  oauthId: {
    type: String,
    default: null
  },
  tier: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free'
  },
  apiKey: {
    type: String,
    unique: true,
    sparse: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  // Onboarding data
  onboarding: {
    completed: { type: Boolean, default: false },
    socialLinks: {
      website: { type: String, default: null },
      twitter: { type: String, default: null },
      discord: { type: String, default: null },
      telegram: { type: String, default: null }
    },
    logo: { type: String, default: null },
    defaultContract: {
      address: { type: String, default: null },
      chain: { type: String, default: null },
      abi: { type: String, default: null },
      name: { type: String, default: null },
      purpose: { type: String, default: null },
      category: { 
        type: String, 
        enum: ['defi', 'nft', 'gaming', 'dao', 'infrastructure', 'other'],
        default: null 
      },
      startDate: { type: Date, default: null },
      isIndexed: { type: Boolean, default: false },
      indexingProgress: { type: Number, default: 0 },
      lastAnalysisId: { type: String, default: null }
    }
  },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      analysis: { type: Boolean, default: true }
    },
    defaultChain: {
      type: String,
      default: 'ethereum'
    }
  },
  usage: {
    analysisCount: { type: Number, default: 0 },
    lastAnalysis: { type: Date, default: null },
    monthlyAnalysisCount: { type: Number, default: 0 },
    monthlyResetDate: { type: Date, default: Date.now }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.emailVerificationToken;
      delete ret.resetPasswordToken;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
// userSchema.index({ email: 1 });
// userSchema.index({ apiKey: 1 });
userSchema.index({ oauthProvider: 1, oauthId: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  if (this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Generate API key
userSchema.methods.generateApiKey = function() {
  this.apiKey = crypto.randomBytes(32).toString('hex');
  return this.apiKey;
};

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  this.emailVerificationToken = crypto.randomBytes(32).toString('hex');
  return this.emailVerificationToken;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  this.resetPasswordToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return this.resetPasswordToken;
};

// Update usage statistics
userSchema.methods.updateUsage = function() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Reset monthly count if new month
  if (this.usage.monthlyResetDate < monthStart) {
    this.usage.monthlyAnalysisCount = 0;
    this.usage.monthlyResetDate = monthStart;
  }
  
  this.usage.analysisCount += 1;
  this.usage.monthlyAnalysisCount += 1;
  this.usage.lastAnalysis = now;
};

// Check if user can perform analysis based on tier limits
userSchema.methods.canPerformAnalysis = function() {
  const limits = {
    free: 10,
    pro: 100,
    enterprise: -1 // unlimited
  };
  
  const limit = limits[this.tier];
  if (limit === -1) return true; // unlimited
  
  return this.usage.monthlyAnalysisCount < limit;
};

export default mongoose.model('User', userSchema);