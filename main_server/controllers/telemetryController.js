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
    const dummy = [
      {
        _id: "6670abcdf123456789012341",
        sensor_id: req.query.sensor_id || "sensor-windows-testing",
        processes: [
          { pid: 1044, name: "chrome.exe", cpu_percent: 1.5, memory_mb: 180, read_count: 50, write_count: 12, connections: 4, risk_score: 5.5, is_anomalous: false, username: "SYSTEM", status: "running" },
          { pid: 4892, name: "powershell.exe (TESTING MOCK)", cpu_percent: 2.8, memory_mb: 75, read_count: 320, write_count: 240, connections: 12, risk_score: 78.4, is_anomalous: true, username: "Rishabh", status: "running" },
          { pid: 9024, name: "ransomware_test.exe (TESTING MOCK)", cpu_percent: 12.4, memory_mb: 140, read_count: 1420, write_count: 1890, connections: 1, risk_score: 95.0, is_anomalous: true, username: "Rishabh", status: "running" }
        ],
        received_at: new Date()
      }
    ];
    res.json({ status: "ok", count: dummy.length, data: dummy, note: "Dummy Mock Data (DB Offline)" });
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
    if (!doc) throw new Error("No telemetry doc found");
    res.json({
      status: "ok",
      sensor_id: doc.sensor_id,
      received_at: doc.received_at,
      data: doc.processes || [],
      indicator: doc.status || "ok"
    });
  } catch (err) {
    res.json({
      status: "ok",
      sensor_id: req.query.sensor_id || "sensor-windows-testing",
      received_at: new Date(),
      data: [
        { pid: 1044, name: "chrome.exe", cpu_percent: 1.5, memory_percent: 4.5, risk_score: 5.5, read_count: 50, write_count: 12 },
        { pid: 4892, name: "powershell.exe (TESTING MOCK)", cpu_percent: 2.8, memory_percent: 2.1, risk_score: 78.4, read_count: 320, write_count: 240 },
        { pid: 9024, name: "ransomware_test.exe (TESTING MOCK)", cpu_percent: 12.4, memory_percent: 6.2, risk_score: 95.0, read_count: 1420, write_count: 1890 }
      ],
      note: "Dummy Mock Data (DB Offline)"
    });
  }
};

module.exports = { getTelemetry, getLatestTelemetry };
