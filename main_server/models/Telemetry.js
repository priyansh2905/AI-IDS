/**
 * models/Telemetry.js
 * Mongoose schema for process telemetry sweeps received from HIDS sensors.
 */

const mongoose = require("mongoose");

const TelemetrySchema = new mongoose.Schema(
  {
    sensor_id: { type: String, required: true, index: true },
    status: { type: String },
    processes: [
      {
        pid: Number,
        name: String,
        cpu_percent: Number,
        memory_mb: Number,
        read_count: Number,
        write_count: Number,
        connections: Number,
        risk_score: Number,
        is_anomalous: Boolean,
        username: String,
        status: String,
      },
    ],
    received_at: { type: Date, default: Date.now, index: true },
  },
  { collection: "telemetry" }
);

module.exports = mongoose.model("Telemetry", TelemetrySchema);
