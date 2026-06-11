const express = require('express');
const { getGroupStandings } = require('../services/bracketService');
const { protect } = require('../middleware/auth');

const router = express.Router();
const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

router.get('/', protect, async (req, res) => {
  try {
    const result = {};
    await Promise.all(
      GROUPS.map(async (g) => {
        result[g] = await getGroupStandings(g);
      })
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
