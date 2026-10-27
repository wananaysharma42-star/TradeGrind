import mongoose from 'mongoose';

const alertRuleSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  ownerRole: {
    type: String,
    enum: ['CUSTOMER', 'COMPANY'],
    required: true
  },
  stockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    default: null
  },
  type: {
    type: String,
    enum: [
      'PRICE_ABOVE',
      'PRICE_BELOW',
      'PCT_CHANGE',
      'PROB_BELOW',
      'PROB_ABOVE',
      'VOLATILITY_ABOVE',
      'RANK_BELOW',
      'HOLDER_COUNT_BELOW'
    ],
    required: true
  },
  threshold: {
    type: Number,
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Target',
    default: null
  },
  cooldownTicks: {
    type: Number,
    default: 390 // 1 simulated trading day default cooldown
  },
  lastTriggeredTick: {
    type: Number,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

alertRuleSchema.index({ ownerId: 1, active: 1 });

export const AlertRule = mongoose.model('AlertRule', alertRuleSchema);
