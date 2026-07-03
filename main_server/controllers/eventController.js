/**
 * controllers/eventController.js
 * Handles public-facing raw event REST endpoints consumed by the React frontend.
 */

const Event = require("../models/Event");

/**
 * GET /api/events
 * Returns recent raw HIDS events (file, network, process, registry).
 * Query params: limit (max 200), event_type, sensor_id
 */
const getEvents = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const filter = {};
    if (req.query.event_type) filter.event_type = req.query.event_type;
    if (req.query.sensor_id) filter.sensor_id = req.query.sensor_id;

    const docs = await Event.find(filter).sort({ timestamp: -1 }).limit(limit).lean();
    res.json({ status: "ok", count: docs.length, data: docs });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

module.exports = { getEvents };
