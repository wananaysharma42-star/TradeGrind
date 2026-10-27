import mongoose from 'mongoose';

const scenarioSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  inputs: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  results: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
}, {
  timestamps: true
});

export const Scenario = mongoose.model('Scenario', scenarioSchema);
