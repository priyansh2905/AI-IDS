/**
 * controllers/mitigateController.js
 * Handles process mitigation and model retraining commands.
 * Routes: Frontend → Express → FastAPI → WebSocket → HIDS Agent
 */

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

const Alert = require("../models/Alert");

const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8001";

/**
 * POST /api/mitigate
 * Forwards a mitigation command (terminate / quarantine / dismiss) to FastAPI,
 * which relays it over WebSocket to the connected HIDS agent.
 *
 * Body: { pid, action, sensor_id }
 */
const mitigateProcess = async (req, res) => {
  const { pid, action, sensor_id } = req.body;

  if (!pid || !action) {
    return res.status(400).json({ status: "error", message: "Missing pid or action" });
  }

  try {
    const fastapiRes = await fetch(`${FASTAPI_URL}/api/mitigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid, action, sensor_id }),
    });
    const result = await fastapiRes.json();

    // Mark the alert as mitigation pending in MongoDB
    Alert.findOneAndUpdate(
      { sensor_id, pid },
      { mitigation_status: "pending", status: "pending" },
      { sort: { timestamp: -1 } }
    ).catch(() => {});

    res.json(result);
  } catch (err) {
    console.error("[!] Mitigation forwarding failed:", err.message);
    res.status(502).json({
      status: "error",
      message: `FastAPI relay failed: ${err.message}`,
    });
  }
};

/**
 * POST /api/retrain
 * Triggers ML model retraining pipeline on the FastAPI backend.
 */
const retrainModel = async (_req, res) => {
  try {
    const fastapiRes = await fetch(`${FASTAPI_URL}/api/retrain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const result = await fastapiRes.json();
    res.json(result);
  } catch (err) {
    res.status(502).json({
      status: "error",
      message: `FastAPI retrain relay failed: ${err.message}`,
    });
  }
};

module.exports = { mitigateProcess, retrainModel };
