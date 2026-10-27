import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
  role: {
    type: String,
    enum: ['CUSTOMER', 'COMPANY'],
    required: true
  },
  virtualBalance: {
    type: Number,
    default: function() {
      return this.role === 'COMPANY' ? 0 : 1000000;
    }
  },
  companyName: {
    type: String,
    default: null,
    trim: true
  },
  sector: {
    type: String,
    default: null,
    trim: true
  },
  stockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    default: null
  },
  avatarColor: {
    type: String,
    default: '#C9A6D8'
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.passwordHash;
      delete ret.__v;
      return ret;
    }
  }
});

export const User = mongoose.model('User', userSchema);
