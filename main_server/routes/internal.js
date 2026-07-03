/**
 * routes/internal.js
 * Internal Express routes — only called by the FastAPI analytics backend.
 * Maps POST endpoints to internalController handlers.
 *
 * Base path: /api/internal  (mounted in server.js)
 */

const { Router } = require("express");
const {
  receiveTelemetry,
  receiveAlert,
  receiveEvent,
  receiveMitigationStatus,
} = require("../controllers/internalController");

const router = Router();

// FastAPI → Express data ingestion
router.post("/telemetry", receiveTelemetry);
router.post("/alert", receiveAlert);
router.post("/event", receiveEvent);
router.post("/mitigation-status", receiveMitigationStatus);

module.exports = router;
