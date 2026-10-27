import mongoose from 'mongoose';

const holdingSchema = new mongoose.Schema({
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
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  avgBuyPrice: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.__v;
      return ret;
    }
  }
});

// Unique compound index on (userId, stockId)
holdingSchema.index({ userId: 1, stockId: 1 }, { unique: true });

// Backward compatibility alias for averageBuyPrice -> avgBuyPrice
holdingSchema.virtual('averageBuyPrice')
  .get(function() { return this.avgBuyPrice; })
  .set(function(val) { this.avgBuyPrice = val; });

export const Holding = mongoose.model('Holding', holdingSchema);
