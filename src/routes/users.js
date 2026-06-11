const express = require('express');
const User = require('../models/User');
const Prediction = require('../models/Prediction');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, restrictTo('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ points: -1, createdAt: 1 });
    const predCounts = await Prediction.aggregate([
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    predCounts.forEach((p) => { countMap[p._id.toString()] = p.count; });

    const result = users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      points: u.points || 0,
      predictions: countMap[u._id.toString()] || 0,
      createdAt: u.createdAt,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/role', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ message: 'Rol inválido' });
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
