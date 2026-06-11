const express = require('express');
const User = require('../models/User');
const Prediction = require('../models/Prediction');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const users = await User.find().select('name email points role').sort({ points: -1 });

    const leaderboard = await Promise.all(
      users.map(async (user, index) => {
        const predictions = await Prediction.find({ user: user._id, isCalculated: true });
        const exactScores = predictions.filter((p) => p.points === 5).length;
        const correctResults = predictions.filter((p) => p.points >= 3).length;
        const totalPredictions = await Prediction.countDocuments({ user: user._id });

        return {
          rank: index + 1,
          user: { id: user._id, name: user.name, email: user.email },
          points: user.points || 0,
          exactScores,
          correctResults,
          totalPredictions,
        };
      })
    );

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
