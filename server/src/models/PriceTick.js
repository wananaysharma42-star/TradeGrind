import mongoose from 'mongoose';

const priceTickSchema = new mongoose.Schema({
  stockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    required: true,
    index: true
  },
  price: {
    type: Number,
    required: true
  },
  tickIndex: {
    type: Number,
    required: true
  },
  simDay: {
    type: Number,
    required: true
  },
  ts: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

// Compound index on (stockId, tickIndex) for sequential lookups and retention
priceTickSchema.index({ stockId: 1, tickIndex: 1 });
priceTickSchema.index({ stockId: 1, ts: -1 });

/**
 * Retention helper: Keeps the last `maxKeep` price ticks per stock (default 2000).
 */
priceTickSchema.statics.pruneOldTicks = async function(stockId, maxKeep = 2000) {
  const count = await this.countDocuments({ stockId });
  if (count > maxKeep) {
    const oldestToKeep = await this.find({ stockId })
      .sort({ tickIndex: -1 })
      .skip(maxKeep - 1)
      .limit(1)
      .select('tickIndex')
      .lean();

    if (oldestToKeep.length > 0) {
      await this.deleteMany({
        stockId,
        tickIndex: { $lt: oldestToKeep[0].tickIndex }
      });
    }
  }
};

export const PriceTick = mongoose.model('PriceTick', priceTickSchema);
