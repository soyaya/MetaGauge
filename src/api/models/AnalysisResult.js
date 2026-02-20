/**
 * Analysis Result model for MongoDB
 */

import mongoose from 'mongoose';

const analysisResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  configId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractConfig',
    required: true
  },
  analysisType: {
    type: String,
    enum: ['single', 'competitive', 'comparative'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  results: {
    target: {
      contract: {
        address: String,
        chain: String,
        name: String
      },
      transactions: Number,
      metrics: mongoose.Schema.Types.Mixed,
      behavior: mongoose.Schema.Types.Mixed,
      reportPaths: {
        json: String,
        csv: String,
        markdown: String
      }
    },
    competitors: [{
      contract: {
        address: String,
        chain: String,
        name: String
      },
      transactions: Number,
      metrics: mongoose.Schema.Types.Mixed,
      behavior: mongoose.Schema.Types.Mixed,
      error: String
    }],
    comparative: {
      summary: mongoose.Schema.Types.Mixed,
      rankings: mongoose.Schema.Types.Mixed,
      insights: [String]
    }
  },
  metadata: {
    blockRange: Number,
    chainsAnalyzed: [String],
    totalTransactions: Number,
    executionTimeMs: Number,
    rpcCallsCount: Number,
    errorCount: Number
  },
  errorMessage: {
    type: String,
    default: null
  },
  aiInterpretation: {
    summary: mongoose.Schema.Types.Mixed,
    insights: mongoose.Schema.Types.Mixed,
    recommendations: [mongoose.Schema.Types.Mixed],
    alerts: [mongoose.Schema.Types.Mixed],
    marketPosition: mongoose.Schema.Types.Mixed,
    technicalAnalysis: mongoose.Schema.Types.Mixed,
    actionItems: [mongoose.Schema.Types.Mixed],
    generatedAt: Date,
    model: String,
    success: { type: Boolean, default: true }
  },
  lastInterpretedAt: {
    type: Date,
    default: null
  },
  logs: [{
    timestamp: { type: Date, default: Date.now },
    level: { type: String, enum: ['info', 'warn', 'error'] },
    message: String,
    data: mongoose.Schema.Types.Mixed
  }],
  scheduledFor: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
analysisResultSchema.index({ userId: 1 });
analysisResultSchema.index({ configId: 1 });
analysisResultSchema.index({ status: 1 });
analysisResultSchema.index({ analysisType: 1 });
analysisResultSchema.index({ createdAt: -1 });
analysisResultSchema.index({ userId: 1, createdAt: -1 });

// Methods
analysisResultSchema.methods.updateProgress = function(progress, message = null) {
  this.progress = Math.min(100, Math.max(0, progress));
  if (message) {
    this.logs.push({
      level: 'info',
      message: message
    });
  }
  return this.save();
};

analysisResultSchema.methods.addLog = function(level, message, data = null) {
  this.logs.push({
    level,
    message,
    data
  });
};

analysisResultSchema.methods.markCompleted = function(results) {
  this.status = 'completed';
  this.progress = 100;
  this.results = results;
  this.completedAt = new Date();
  this.addLog('info', 'Analysis completed successfully');
};

analysisResultSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.errorMessage = error.message || error;
  this.completedAt = new Date();
  this.addLog('error', 'Analysis failed', { error: error.message || error });
};

// Static methods
analysisResultSchema.statics.getAnalysisHistory = function(userId, limit = 20, offset = 0) {
  return this.find({ userId })
    .populate('configId', 'name targetContract')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset)
    .select('-logs -results.target.metrics -results.competitors.metrics');
};

analysisResultSchema.statics.getAnalysisStats = function(userId) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        pending: {
          $sum: { $cond: [{ $in: ['$status', ['pending', 'running']] }, 1, 0] }
        },
        avgExecutionTime: {
          $avg: '$metadata.executionTimeMs'
        }
      }
    }
  ]);
};

export default mongoose.model('AnalysisResult', analysisResultSchema);