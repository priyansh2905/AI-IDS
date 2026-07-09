/**
 * models/User.js
 * Mongoose schema for AI-HIDS users.
 */

const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true }, // Plainttext password for simple mock environment testing
    role: { type: String, enum: ["admin", "type-1", "type-2"], required: true },
    sensor_id: { type: String, default: null }, // Sensor ID Key generated for Type-2 Host users
    user_key: { type: String, required: true, unique: true, index: true },
    email: { type: String, default: null },
  },
  { collection: "users" }
);

module.exports = mongoose.model("User", UserSchema);
