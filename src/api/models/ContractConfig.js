/**
 * Contract Configuration model for MongoDB
 */

import mongoose from 'mongoose';

const contractSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    lowercase: true
  },
  chain: {
    type: String,
    required: true,
    enum: ['ethereum', 'lisk', 'starknet', 'polygon', 'base', 'arbitrum', 'optimism']
  },
  name: {
    type: String,
    required: true
  },
  abi: {
    type: String, // ABI file path or JSON string
    default: null
  }
});

const rpcConfigSchema = new mongoose.Schema({
  ethereum: [String],
  lisk: [String],
  starknet: [String],
  polygon: [String],
  base: [String],
  arbitrum: [String],
  optimism: [String]
});

const analysisParamsSchema = new mongoose.Schema({
  blockRange: {
    type: Number,
    default: 1000,
    min: 100,
    max: 10000
  },
  whaleThreshold: {
    type: Number,
    default: 10 // ETH
  },
  maxConcurrentRequests: {
    type: Number,
    default: 5,
    min: 1,
    max: 20
  },
  failoverTimeout: {
    type: Number,
    default: 30000 // 30 seconds
  },
  maxRetries: {
    type: Number,
    default: 2,
    min: 1,
    max: 5
  },
  outputFormats: [{
    type: String,
    enum: ['json', 'csv', 'markdown']
  }]
});

const contractConfigSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  targetContract: {
    type: contractSchema,
    required: true
  },
  competitors: [contractSchema],
  rpcConfig: {
    type: rpcConfigSchema,
    required: true
  },
  analysisParams: {
    type: analysisParamsSchema,
    default: () => ({})
  },
  tags: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastAnalyzed: {
    type: Date,
    default: null
  },
  analysisCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
contractConfigSchema.index({ userId: 1 });
contractConfigSchema.index({ userId: 1, name: 1 }, { unique: true });
contractConfigSchema.index({ 'targetContract.address': 1, 'targetContract.chain': 1 });
contractConfigSchema.index({ tags: 1 });
contractConfigSchema.index({ isActive: 1 });

// Virtual for analysis history
contractConfigSchema.virtual('analysisHistory', {
  ref: 'AnalysisResult',
  localField: '_id',
  foreignField: 'configId'
});

// Methods
contractConfigSchema.methods.updateAnalysisStats = function() {
  this.lastAnalyzed = new Date();
  this.analysisCount += 1;
};

// Validation
contractConfigSchema.pre('save', function(next) {
  // Ensure RPC config has at least one URL for target chain
  const targetChain = this.targetContract.chain;
  if (!this.rpcConfig[targetChain] || this.rpcConfig[targetChain].length === 0) {
    return next(new Error(`RPC configuration required for ${targetChain} chain`));
  }
  
  // Validate competitor chains have RPC configs
  for (const competitor of this.competitors) {
    if (!this.rpcConfig[competitor.chain] || this.rpcConfig[competitor.chain].length === 0) {
      return next(new Error(`RPC configuration required for competitor chain: ${competitor.chain}`));
    }
  }
  
  next();
});

export default mongoose.model('ContractConfig', contractConfigSchema);