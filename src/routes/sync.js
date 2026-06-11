const express = require('express');
const { protect, restrictTo } = require('../middleware/auth');
const { syncResults } = require('../services/syncService');

const router = express.Router();

router.post('/results', protect, restrictTo('admin'), async (req, res) => {
  try {
    const summary = await syncResults();
    res.json({ message: 'Sincronización completada', ...summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
