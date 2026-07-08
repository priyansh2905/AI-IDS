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
const { generateAlertReport } = require("../controllers/reportController");
const { getEvents } = require("../controllers/eventController");
const { mitigateProcess, retrainModel } = require("../controllers/mitigateController");
const { signup, login, getUsers, deleteUser } = require("../controllers/userController");
const {
  getGroups,
  createGroup,
  deleteGroup,
  exitGroup,
  joinRequest,
  approveJoinRequest,
  inviteUser,
  acceptInvite,
  declineInvite,
  updateGroupStatus,
  searchPublicGroup
} = require("../controllers/groupController");

const authMiddleware = require("../middleware/authMiddleware");

const router = Router();

// ── Public Routes (Auth & Health) ─────────────────────────────────────────────
router.post("/auth/signup", signup);
router.post("/auth/login", login);
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "AI-HIDS Express Main Server",
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    ws_clients: clientCount(),
    timestamp: new Date().toISOString(),
  });
});

// ── Secure Routes Guard ──────────────────────────────────────────────────────
router.use(authMiddleware);

// ── Secure Users ─────────────────────────────────────────────────────────────
router.get("/users", getUsers);
router.delete("/users/:id", deleteUser);

// ── Collaborative Groups ──────────────────────────────────────────────────────
router.get("/groups", getGroups);
router.post("/groups", createGroup);
router.delete("/groups/:id", deleteGroup);
router.post("/groups/:id/exit", exitGroup);
router.post("/groups/:id/request", joinRequest);
router.post("/groups/:id/approve", approveJoinRequest);
router.post("/groups/:id/invite", inviteUser);
router.post("/groups/:id/accept", acceptInvite);
router.post("/groups/:id/decline", declineInvite);
router.patch("/groups/:id/status", updateGroupStatus);
router.get("/groups/search/:group_key", searchPublicGroup);

// ── Telemetry ─────────────────────────────────────────────────────────────────
router.get("/telemetry", getTelemetry);
router.get("/telemetry/latest", getLatestTelemetry);

// ── Alerts ────────────────────────────────────────────────────────────────────
router.get("/alerts/stats", getAlertStats);   // must be before /alerts/:id
router.get("/alerts", getAlerts);
router.patch("/alerts/:id/acknowledge", acknowledgeAlert);
router.post("/alerts/:id/report", generateAlertReport);

// ── Events ────────────────────────────────────────────────────────────────────
router.get("/events", getEvents);

// ── Mitigation & Retraining ───────────────────────────────────────────────────
router.post("/mitigate", mitigateProcess);
router.post("/retrain", retrainModel);

module.exports = router;
