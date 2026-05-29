import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  userId:          { type: String, required: true, index: true },
  contractAddress: { type: String, required: true },
  chain:           { type: String },
  type: {
    type: String,
    enum: ['whale_accumulation', 'sentiment_shift', 'dev_activity', 'liquidity_drop', 'risk_spike'],
    required: true,
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  message: { type: String, required: true },
  read:    { type: Boolean, default: false },
}, { timestamps: true });

alertSchema.index({ userId: 1, read: 1, createdAt: -1 });

export default mongoose.model('Alert', alertSchema);
