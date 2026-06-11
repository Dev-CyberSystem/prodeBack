const express = require('express');
const Prediction = require('../models/Prediction');
const Match = require('../models/Match');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Mis predicciones
router.get('/my', protect, async (req, res) => {
  try {
    const predictions = await Prediction.find({ user: req.user._id }).populate('match');
    res.json(predictions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Todas las predicciones de un partido (admin o post-partido)
router.get('/match/:matchId', protect, async (req, res) => {
  try {
    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ message: 'Partido no encontrado' });

    // Solo se pueden ver todas las predicciones si el partido ya terminó o si es admin
    if (!match.isFinished && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Las predicciones se revelan al finalizar el partido' });
    }

    const predictions = await Prediction.find({ match: req.params.matchId }).populate('user', 'name');
    res.json(predictions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Crear o actualizar predicción
router.post('/', protect, async (req, res) => {
  try {
    const { matchId, homeScore, awayScore } = req.body;

    if (homeScore === undefined || awayScore === undefined || homeScore < 0 || awayScore < 0) {
      return res.status(400).json({ message: 'Scores inválidos' });
    }

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: 'Partido no encontrado' });

    if (match.isFinished) {
      return res.status(400).json({ message: 'El partido ya finalizó, no podés editar tu predicción' });
    }

    if (new Date() >= new Date(match.matchDate)) {
      return res.status(400).json({ message: 'El partido ya comenzó, no podés editar tu predicción' });
    }

    const prediction = await Prediction.findOneAndUpdate(
      { user: req.user._id, match: matchId },
      { homeScore, awayScore, points: 0, isCalculated: false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(prediction);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
