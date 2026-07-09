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
    pending_requests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    pending_invitations: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    group_key: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ["public", "private"], default: "public" },
    member_preferences: [
      {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        email_alerts: { type: Boolean, default: false },
        email_join_requests: { type: Boolean, default: false },
        email_invites: { type: Boolean, default: false }
      }
    ]
  },
  { collection: "groups" }
);

module.exports = mongoose.model("Group", GroupSchema);
