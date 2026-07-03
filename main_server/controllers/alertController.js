/**
 * controllers/alertController.js
 * Handles public-facing alert REST endpoints consumed by the React frontend.
 */

const Alert = require("../models/Alert");
const { broadcast } = require("../websocket/broadcaster");

/**
 * GET /api/alerts
 * Returns paginated alerts (most recent first).
 * Query params: limit (max 200), skip, sensor_id, acknowledged
 */
const getAlerts = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const skip = parseInt(req.query.skip) || 0;
    const filter = {};
    if (req.query.sensor_id) filter.sensor_id = req.query.sensor_id;
    if (req.query.acknowledged !== undefined)
      filter.acknowledged = req.query.acknowledged === "true";

    const [docs, total] = await Promise.all([
      Alert.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      Alert.countDocuments(filter),
    ]);
    res.json({ status: "ok", total, count: docs.length, data: docs });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /api/alerts/stats
 * Returns aggregate alert counts for the dashboard header.
 */
const getAlertStats = async (_req, res) => {
  try {
    const [total, unacknowledged, highRisk] = await Promise.all([
      Alert.countDocuments(),
      Alert.countDocuments({ acknowledged: false }),
      Alert.countDocuments({ risk_score: { $gte: 70 } }),
    ]);
    res.json({ status: "ok", data: { total, unacknowledged, high_risk: highRisk } });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * PATCH /api/alerts/:id/acknowledge
 * Marks a single alert as acknowledged and broadcasts the update to the frontend.
 */
const acknowledgeAlert = async (req, res) => {
  try {
    const doc = await Alert.findByIdAndUpdate(
      req.params.id,
      { acknowledged: true },
      { new: true }
    );
    if (!doc) return res.status(404).json({ status: "error", message: "Alert not found" });
    broadcast("alert_update", doc.toObject());
    res.json({ status: "ok", data: doc });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

module.exports = { getAlerts, getAlertStats, acknowledgeAlert };
