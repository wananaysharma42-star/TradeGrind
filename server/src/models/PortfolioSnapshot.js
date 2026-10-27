import mongoose from 'mongoose';

const portfolioSnapshotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  simDay: {
    type: Number,
    required: true
  },
  totalValue: {
    type: Number,
    required: true
  },
  cash: {
    type: Number,
    required: true
  },
  holdingsValue: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

portfolioSnapshotSchema.index({ userId: 1, simDay: 1 }, { unique: true });

export const PortfolioSnapshot = mongoose.model('PortfolioSnapshot', portfolioSnapshotSchema);
