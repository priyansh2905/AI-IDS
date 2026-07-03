/**
 * routes/api.js
 * Public Express routes consumed by the React frontend.
 * Maps all REST endpoints to their respective controller handlers.
 *
 * Base path: /api  (mounted in server.js)
 */

const { Router } = require("express");
const mongoose = require("mongoose");
const { clientCount } = require("../websocket/broadcaster");

const { getTelemetry, getLatestTelemetry } = require("../controllers/telemetryController");
const { getAlerts, getAlertStats, acknowledgeAlert } = require("../controllers/alertController");
const { getEvents } = require("../controllers/eventController");
const { mitigateProcess, retrainModel } = require("../controllers/mitigateController");

const router = Router();

// ── Health Check ─────────────────────────────────────────────────────────────
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "AI-HIDS Express Main Server",
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    ws_clients: clientCount(),
    timestamp: new Date().toISOString(),
  });
});

// ── Telemetry ─────────────────────────────────────────────────────────────────
router.get("/telemetry", getTelemetry);
router.get("/telemetry/latest", getLatestTelemetry);

// ── Alerts ────────────────────────────────────────────────────────────────────
router.get("/alerts/stats", getAlertStats);   // must be before /alerts/:id
router.get("/alerts", getAlerts);
router.patch("/alerts/:id/acknowledge", acknowledgeAlert);

// ── Events ────────────────────────────────────────────────────────────────────
router.get("/events", getEvents);

// ── Mitigation & Retraining ───────────────────────────────────────────────────
router.post("/mitigate", mitigateProcess);
router.post("/retrain", retrainModel);

module.exports = router;
