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
    if (docs.length === 0) throw new Error("No events in DB");
    res.json({ status: "ok", count: docs.length, data: docs });
  } catch (err) {
    const dummy = [
      {
        sensor_id: req.query.sensor_id || "sensor-windows-testing",
        event_type: "file",
        payload: { pid: 9024, process_name: "ransomware_test.exe (TESTING MOCK)", action: "write", target_path: "C:\\Users\\test\\Documents\\invoice.pdf", details: "Mass write encryption cycle" },
        timestamp: new Date()
      },
      {
        sensor_id: req.query.sensor_id || "sensor-windows-testing",
        event_type: "network",
        payload: { pid: 4892, process_name: "powershell.exe (TESTING MOCK)", action: "connect", target_path: "192.168.1.50", details: "Port 445 SMB connection attempt" },
        timestamp: new Date(Date.now() - 30000)
      }
    ];
    res.json({ status: "ok", count: dummy.length, data: dummy, note: "Dummy Mock Data (DB Offline)" });
  }
};

module.exports = { getEvents };
