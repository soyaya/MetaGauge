import mongoose from 'mongoose';

const analysisSchema = new mongoose.Schema({
  userId:          { type: String, required: true, index: true },
  contractAddress: { type: String, required: true },
  chain:           { type: String, required: true },
  contractName:    { type: String },

  status: {
    type: String,
    enum: ['pending', 'running', 'complete', 'failed'],
    default: 'pending',
  },

  // Scores (0–100)
  tractionScore:        Number,
  riskScore:            Number,
  sustainabilityScore:  Number,
  communityHealthScore: Number,
  growthProbability:    Number,
  confidenceInterval:   Number,
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
  },

  // Raw collected data
  onChainMetrics:    mongoose.Schema.Types.Mixed,
  githubMetrics:     mongoose.Schema.Types.Mixed,
  sentimentMetrics:  mongoose.Schema.Types.Mixed,
  walletIntelligence: mongoose.Schema.Types.Mixed,
  riskSignals:       [String],

  // AI output
  aiSummary:  String,
  components: mongoose.Schema.Types.Mixed, // frontend render components

  errorMessage: String,
}, { timestamps: true });

// Always get latest analysis for a user+contract
analysisSchema.index({ userId: 1, contractAddress: 1, createdAt: -1 });

export default mongoose.model('Analysis', analysisSchema);
