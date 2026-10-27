import mongoose from 'mongoose';

const dailyCandleSchema = new mongoose.Schema({
  stockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    required: true,
    index: true
  },
  simDay: {
    type: Number,
    required: true
  },
  open: {
    type: Number,
    required: true
  },
  high: {
    type: Number,
    required: true
  },
  low: {
    type: Number,
    required: true
  },
  close: {
    type: Number,
    required: true
  },
  volume: {
    type: Number,
    required: true,
    default: 0
  },
  logReturn: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Unique compound index on (stockId, simDay)
dailyCandleSchema.index({ stockId: 1, simDay: 1 }, { unique: true });

export const DailyCandle = mongoose.model('DailyCandle', dailyCandleSchema);
