/**
 * controllers/internalController.js
 * Handles data ingestion from FastAPI (internal routes only).
 * FastAPI POSTs here after receiving data from the HIDS agent.
 *
 * These routes are NOT exposed publicly — only FastAPI calls them.
 */

const Telemetry = require("../models/Telemetry");
const Alert = require("../models/Alert");
const Event = require("../models/Event");
const { broadcast } = require("../websocket/broadcaster");

/**
 * POST /api/internal/telemetry
 * Receives a process telemetry sweep from FastAPI, persists to MongoDB,
 * and broadcasts it to all connected frontend WebSocket clients.
 */
const receiveTelemetry = async (req, res) => {
  try {
    const payload = req.body;
    const doc = await Telemetry.create(payload);
    broadcast("telemetry", payload);
    res.json({ status: "ok", id: doc._id });
  } catch (err) {
    console.error("[!] Failed to persist telemetry:", err.message);
    // Still broadcast so the frontend gets live data even if DB write fails
    broadcast("telemetry", req.body);
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * POST /api/internal/alert
 * Receives an intrusion alert from FastAPI, persists to MongoDB,
 * and broadcasts it to connected frontend clients.
 */
const receiveAlert = async (req, res) => {
  try {
    const payload = req.body;
    if (payload.rule_triggers && !payload.rule_hits) {
      payload.rule_hits = payload.rule_triggers;
    }
    const doc = await Alert.create(payload);
    broadcast("alert", { ...payload, _id: doc._id });
    res.json({ status: "ok", id: doc._id });
  } catch (err) {
    console.error("[!] Failed to persist alert:", err.message);
    broadcast("alert", req.body);
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * POST /api/internal/event
 * Receives a raw file/network/process event from FastAPI, persists to MongoDB,
 * and broadcasts it to connected frontend clients.
 */
const receiveEvent = async (req, res) => {
  try {
    const payload = req.body;
    const doc = await Event.create(payload);
    broadcast("event", { ...payload, _id: doc._id });
    res.json({ status: "ok", id: doc._id });
  } catch (err) {
    console.error("[!] Failed to persist event:", err.message);
    broadcast("event", req.body);
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * POST /api/internal/mitigation-status
 * Receives an agent ack after a mitigation command executes.
 * Updates the alert document and broadcasts the result to the frontend.
 */
const receiveMitigationStatus = async (req, res) => {
  const { sensor_id, data } = req.body;

  try {
    const parsed = JSON.parse(data);
    broadcast("mitigation_status", { sensor_id, ...parsed });

    // Map action type → DB status string
    if (parsed.pid && parsed.status === "success") {
      const statusMap = {
        terminate: "terminated",
        quarantine: "quarantined",
        dismiss: "dismissed",
      };
      const newStatus = statusMap[parsed.type] || "none";
      Alert.findOneAndUpdate(
        { sensor_id, pid: parsed.pid },
        { mitigation_status: newStatus, status: parsed.type },
        { sort: { timestamp: -1 } }
      ).catch((e) => console.warn("[!] Could not update mitigation status in DB:", e.message));
    }
  } catch (_) {
    // Data might not be JSON — broadcast raw
    broadcast("mitigation_status", { sensor_id, raw: data });
  }

  res.json({ status: "ok" });
};

module.exports = {
  receiveTelemetry,
  receiveAlert,
  receiveEvent,
  receiveMitigationStatus,
};
