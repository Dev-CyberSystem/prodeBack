const express = require('express');
const Match = require('../models/Match');
const Prediction = require('../models/Prediction');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');
const { updateBracket } = require('../services/bracketService');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const matches = await Match.find().sort({ matchDate: 1 });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, restrictTo('admin'), async (req, res) => {
  try {
    const match = await Match.create(req.body);
    res.status(201).json(match);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const match = await Match.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!match) return res.status(404).json({ message: 'Partido no encontrado' });
    res.json(match);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Cierra el partido y calcula puntos
router.put('/:id/score', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { homeScore, awayScore } = req.body;
    if (homeScore === undefined || awayScore === undefined) {
      return res.status(400).json({ message: 'Se requieren homeScore y awayScore' });
    }

    const match = await Match.findByIdAndUpdate(
      req.params.id,
      { homeScore, awayScore, isFinished: true },
      { new: true }
    );
    if (!match) return res.status(404).json({ message: 'Partido no encontrado' });

    const actualResult = homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw';

    const predictions = await Prediction.find({ match: match._id });

    for (const prediction of predictions) {
      let pts = 0;
      const predResult =
        prediction.homeScore > prediction.awayScore
          ? 'home'
          : prediction.homeScore < prediction.awayScore
          ? 'away'
          : 'draw';

      if (predResult === actualResult) {
        pts += 3;
        if (prediction.homeScore === homeScore && prediction.awayScore === awayScore) {
          pts += 2;
        }
      }

      prediction.points = pts;
      prediction.isCalculated = true;
      await prediction.save();
    }

    // Recalcular puntos totales de cada usuario
    const userIds = [...new Set(predictions.map((p) => p.user.toString()))];
    for (const userId of userIds) {
      const allPredictions = await Prediction.find({ user: userId, isCalculated: true });
      const totalPoints = allPredictions.reduce((sum, p) => sum + p.points, 0);
      await User.findByIdAndUpdate(userId, { points: totalPoints });
    }

    // Auto-completar bracket con el resultado nuevo
    updateBracket().catch(console.error);

    res.json({ match, message: 'Resultado cargado y puntos calculados' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    await Match.findByIdAndDelete(req.params.id);
    await Prediction.deleteMany({ match: req.params.id });
    res.json({ message: 'Partido eliminado' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
