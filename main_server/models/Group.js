/**
 * models/Group.js
 * Mongoose schema for collaborative security cells.
 */

const mongoose = require("mongoose");

const GroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    creator_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    pending_requests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { collection: "groups" }
);

module.exports = mongoose.model("Group", GroupSchema);
