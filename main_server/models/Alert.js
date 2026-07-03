/**
 * models/Alert.js
 * Mongoose schema for intrusion alerts raised by the HIDS agent.
 */

const mongoose = require("mongoose");

const AlertSchema = new mongoose.Schema(
  {
    sensor_id: { type: String, required: true, index: true },
    pid: { type: Number, required: true },
    process_name: String,
    risk_score: Number,
    anomaly_score: Number,
    rule_hits: [String],
    rule_triggers: [String],
    classification: String,
    confidence: Number,
    explanation: String,
    status: { type: String, default: "Active" },
    timestamp: { type: Date, default: Date.now, index: true },
    acknowledged: { type: Boolean, default: false },
    mitigation_status: {
      type: String,
      enum: ["none", "pending", "terminated", "quarantined", "dismissed"],
      default: "none",
    },
  },
  { collection: "alerts" }
);

module.exports = mongoose.model("Alert", AlertSchema);
