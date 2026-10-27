import mongoose from 'mongoose';

const targetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  stockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    required: true,
    index: true
  },
  targetPrice: {
    type: Number,
    required: true,
    min: 0.01
  },
  deadlineDays: {
    type: Number,
    required: true,
    min: 1
  },
  startTick: {
    type: Number,
    required: true
  },
  startPrice: {
    type: Number,
    required: true
  },
  mode: {
    type: String,
    enum: ['touch', 'terminal'],
    default: 'touch',
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'HIT', 'MISSED', 'CANCELLED'],
    default: 'ACTIVE',
    index: true
  },
  lastProbability: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

targetSchema.index({ userId: 1, status: 1 });

export const Target = mongoose.model('Target', targetSchema);
