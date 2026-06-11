const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  match: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true,
  },
  homeScore: {
    type: Number,
    required: true,
    min: 0,
  },
  awayScore: {
    type: Number,
    required: true,
    min: 0,
  },
  points: {
    type: Number,
    default: 0,
  },
  isCalculated: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

predictionSchema.index({ user: 1, match: 1 }, { unique: true });

module.exports = mongoose.model('Prediction', predictionSchema);
