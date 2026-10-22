const express = require('express');
const LocationModel = require('../models/Location');
const { dayKey, revealTime, pickSpot } = require('../lib/spotClock');

const router = express.Router();

// GET all locations
router.get('/', async (req, res) => {
  try {
    const locations = await LocationModel.find({});
    res.status(200).json(locations);
  } catch (err) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// GET today's spot. The spot itself is only sent once it has been revealed.
router.get('/today', async (req, res) => {
  try {
    const locations = await LocationModel.find({ isActive: true }).sort({ _id: 1 });
    const day = dayKey();
    const spot = pickSpot(locations, day);
    if (!spot) {
      return res.status(404).json({ message: 'No active locations' });
    }

    const revealAt = revealTime(day);
    const revealed = Date.now() >= revealAt.getTime();
    res.json({
      day,
      revealAt,
      revealed,
      spot: revealed
        ? { name: spot.name, description: spot.description, coordinates: spot.coordinates }
        : null,
    });
  } catch (err) {
    console.error("Error fetching today's spot:", err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
