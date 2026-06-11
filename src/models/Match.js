const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  bracketId: { type: Number, unique: true, sparse: true },
  homeTeam: { type: String, required: true },
  awayTeam: { type: String, required: true },
  homeFlag: { type: String, default: '' },
  awayFlag: { type: String, default: '' },
  homeSlot: { type: String, default: '' },
  awaySlot: { type: String, default: '' },
  matchDate: { type: Date, required: true },
  stage: {
    type: String,
    enum: ['Fase de Grupos', 'Ronda de 32', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Tercer Puesto', 'Final'],
    default: 'Fase de Grupos',
  },
  group: { type: String, default: '' },
  homeScore: { type: Number, default: null },
  awayScore: { type: Number, default: null },
  isFinished: { type: Boolean, default: false },
}, { timestamps: true });

matchSchema.virtual('result').get(function () {
  if (this.homeScore === null || this.awayScore === null) return null;
  if (this.homeScore > this.awayScore) return 'home';
  if (this.homeScore < this.awayScore) return 'away';
  return 'draw';
});

matchSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Match', matchSchema);
