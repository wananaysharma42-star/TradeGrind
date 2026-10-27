import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  stockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    required: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  type: {
    type: String,
    enum: ['MARKET_BUY', 'MARKET_SELL', 'LIMIT_BUY', 'LIMIT_SELL'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number, // Limit price or estimated order price
    required: true
  },
  executedPrice: {
    type: Number,
    default: null
  },
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'EXECUTED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },
  executedAtTick: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

export const Order = mongoose.model('Order', orderSchema);
