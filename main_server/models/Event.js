/**
 * models/Event.js
 * Mongoose schema for raw file / network / process / registry events
 * captured by the HIDS sensor.
 */

const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema(
  {
    sensor_id: { type: String, required: true, index: true },
    event_type: {
      type: String,
      enum: ["file", "network", "process", "registry"],
      index: true,
    },
    payload: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { collection: "events" }
);

module.exports = mongoose.model("Event", EventSchema);
