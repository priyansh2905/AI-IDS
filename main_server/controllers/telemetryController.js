/**
 * controllers/telemetryController.js
 * Handles public-facing telemetry REST endpoints consumed by the React frontend.
 */

const Telemetry = require("../models/Telemetry");

/**
 * GET /api/telemetry
 * Returns paginated telemetry sweeps (most recent first).
 * Query params: limit (max 100), sensor_id
 */
const getTelemetry = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const filter = req.query.sensor_id ? { sensor_id: req.query.sensor_id } : {};
    const docs = await Telemetry.find(filter).sort({ received_at: -1 }).limit(limit).lean();
    res.json({ status: "ok", count: docs.length, data: docs });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /api/telemetry/latest
 * Returns the most recent process snapshot (processes array only) for a sensor.
 * Query params: sensor_id
 */
const getLatestTelemetry = async (req, res) => {
  try {
    const filter = req.query.sensor_id ? { sensor_id: req.query.sensor_id } : {};
    const doc = await Telemetry.findOne(filter).sort({ received_at: -1 }).lean();
    if (!doc) return res.json({ status: "ok", data: [] });
    res.json({
      status: "ok",
      sensor_id: doc.sensor_id,
      received_at: doc.received_at,
      data: doc.processes,
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

module.exports = { getTelemetry, getLatestTelemetry };
