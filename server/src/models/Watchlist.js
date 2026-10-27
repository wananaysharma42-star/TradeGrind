import mongoose from 'mongoose';

const watchlistSchema = new mongoose.Schema({
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
  }
}, {
  timestamps: true
});

watchlistSchema.index({ userId: 1, stockId: 1 }, { unique: true });

export const Watchlist = mongoose.model('Watchlist', watchlistSchema);
