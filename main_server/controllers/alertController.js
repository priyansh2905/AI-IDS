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
    if (docs.length === 0) throw new Error("No alerts in DB");
    res.json({ status: "ok", total, count: docs.length, data: docs });
  } catch (err) {
    const dummy = [
      {
        _id: "6670abcde123456789012345",
        sensor_id: req.query.sensor_id || "sensor-windows-testing",
        pid: 9024,
        process_name: "ransomware_test.exe (TESTING MOCK)",
        risk_score: 95.0,
        anomaly_score: 91.2,
        rule_hits: ["MASS_FILE_RENAME", "TEMP_DIR_EXECUTION"],
        rule_triggers: ["MASS_FILE_RENAME", "TEMP_DIR_EXECUTION"],
        classification: "Malicious",
        confidence: 94.0,
        explanation: "Process performed mass writes to unique target file locations in AppData/Temp folders. Heuristic matches high entropy file header changes.",
        status: "Active",
        timestamp: new Date(),
        acknowledged: false,
        mitigation_status: "none"
      },
      {
        _id: "6670abcde123456789012346",
        sensor_id: req.query.sensor_id || "sensor-windows-testing",
        pid: 4892,
        process_name: "powershell.exe (TESTING MOCK)",
        risk_score: 78.4,
        anomaly_score: 65.0,
        rule_hits: ["SENSITIVE_FILE_ACCESS"],
        rule_triggers: ["SENSITIVE_FILE_ACCESS"],
        classification: "Suspicious",
        confidence: 82.0,
        explanation: "Executed system call pattern trying to read host credentials file hives.",
        status: "Active",
        timestamp: new Date(Date.now() - 60000),
        acknowledged: false,
        mitigation_status: "none"
      }
    ];
    res.json({ status: "ok", total: dummy.length, count: dummy.length, data: dummy, note: "Dummy Mock Data (DB Offline)" });
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
    res.json({ status: "ok", data: { total: 2, unacknowledged: 2, high_risk: 2 }, note: "Dummy Mock Data (DB Offline)" });
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
