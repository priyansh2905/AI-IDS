/**
 * controllers/userController.js
 * Handles User database transactions (Registration, Login, Listing, Deletion).
 */

const User = require("../models/User");
const Group = require("../models/Group");

/**
 * POST /api/auth/signup
 */
const signup = async (req, res) => {
  const { username, password, role, sensor_id } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ status: "error", message: "Missing username, password or role" });
  }

  try {
    const existing = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, "i") } });
    if (existing) {
      return res.status(400).json({ status: "error", message: "Username is already taken" });
    }

    const user_key = `key-${username.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newUser = await User.create({
      username,
      password,
      role,
      sensor_id: role === "type-2" ? sensor_id : null,
      user_key
    });

    res.json({
      status: "ok",
      user: {
        id: newUser._id,
        username: newUser.username,
        role: newUser.role,
        sensor_id: newUser.sensor_id,
        user_key: newUser.user_key
      }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res) => {
  const { username, password, role, sensorId } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ status: "error", message: "Missing credentials" });
  }

  try {
    const found = await User.findOne({
      username: { $regex: new RegExp(`^${username}$`, "i") },
      role
    });

    if (!found) {
      return res.status(400).json({ status: "error", message: "Invalid username or selected access role" });
    }

    if (found.password !== password) {
      return res.status(400).json({ status: "error", message: "Incorrect password" });
    }

    if (role === "type-2" && found.sensor_id !== sensorId) {
      return res.status(400).json({ status: "error", message: "Invalid Sensor ID Key" });
    }

    // Generate mock JWT token base64 encoded
    const userData = {
      id: found._id,
      username: found.username,
      role: found.role,
      sensor_id: found.sensor_id,
      user_key: found.user_key
    };
    const mockToken = `mock-jwt-token-head.${Buffer.from(JSON.stringify(userData)).toString("base64")}.signature`;

    res.json({
      status: "ok",
      token: mockToken,
      user: userData
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /api/users
 */
const getUsers = async (_req, res) => {
  try {
    const users = await User.find({}, "-password").lean();
    const formatted = users.map(u => ({
      id: u._id,
      username: u.username,
      role: u.role,
      sensor_id: u.sensor_id,
      user_key: u.user_key
    }));
    res.json({ status: "ok", data: formatted });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * DELETE /api/users/:id
 */
const deleteUser = async (req, res) => {
  const userId = req.params.id;

  try {
    const deleted = await User.findByIdAndDelete(userId);
    if (!deleted) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    // Cascade cleanups: pull the deleted user ID from all groups
    await Group.updateMany(
      {},
      {
        $pull: {
          members: userId,
          pending_requests: userId
        }
      }
    );

    res.json({ status: "ok", message: "User deleted and membership records updated successfully" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

module.exports = { signup, login, getUsers, deleteUser };
