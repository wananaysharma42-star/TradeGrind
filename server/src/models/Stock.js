import mongoose from 'mongoose';

const stockSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  sector: {
    type: String,
    required: true,
    trim: true
  },
  mu: {
    type: Number,
    required: true, // Annualised drift
    min: 0.05,
    max: 0.25
  },
  sigma: {
    type: Number,
    required: true, // Annualised volatility
    min: 0.15,
    max: 0.50
  },
  currentPrice: {
    type: Number,
    required: true,
    min: 0.01
  },
  previousClose: {
    type: Number,
    required: true,
    min: 0.01
  },
  ownerCompany: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  totalShares: {
    type: Number,
    required: true,
    default: 50000000
  },
  tickCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0 // for "Most Viewed" filter
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

// Virtual marketCap calculation: currentPrice * totalShares
stockSchema.virtual('marketCap').get(function() {
  return Math.round((this.currentPrice || 0) * (this.totalShares || 0));
});

// Virtual dayChange calculation
stockSchema.virtual('dayChange').get(function() {
  if (!this.previousClose) return 0;
  return Math.round(((this.currentPrice || 0) - this.previousClose) * 100) / 100;
});

// Virtual dayChangePercent calculation
stockSchema.virtual('dayChangePercent').get(function() {
  if (!this.previousClose || this.previousClose === 0) return 0;
  return Math.round((((this.currentPrice || 0) - this.previousClose) / this.previousClose) * 10000) / 100;
});

export const Stock = mongoose.model('Stock', stockSchema);
