/**
 * controllers/userController.js
 * Handles User database transactions (Registration, Login, Listing, Deletion).
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
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
    
    // Hash password before saving to DB
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      password: hashedPassword,
      role,
      sensor_id: role === "type-2" ? sensor_id : null,
      user_key
    });

    const userData = {
      id: newUser._id,
      username: newUser.username,
      role: newUser.role,
      sensor_id: newUser.sensor_id,
      user_key: newUser.user_key,
      email: newUser.email || null
    };

    // Generate real JWT token
    const secret = process.env.JWT_SECRET || "dev_fallback_secret_key_9999";
    const token = jwt.sign(userData, secret, { expiresIn: "7d" });

    res.json({
      status: "ok",
      token,
      user: userData
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

    // Secure comparison (with plaintext fallback for older legacy records)
    let isMatch = false;
    if (found.password.startsWith("$2a$") || found.password.startsWith("$2b$")) {
      isMatch = await bcrypt.compare(password, found.password);
    } else {
      isMatch = found.password === password;
    }

    if (!isMatch) {
      return res.status(400).json({ status: "error", message: "Incorrect password" });
    }

    if (role === "type-2" && found.sensor_id !== sensorId) {
      return res.status(400).json({ status: "error", message: "Invalid Sensor ID Key" });
    }

    const userData = {
      id: found._id,
      username: found.username,
      role: found.role,
      sensor_id: found.sensor_id,
      user_key: found.user_key,
      email: found.email || null
    };

    // Generate real JWT token
    const secret = process.env.JWT_SECRET || "dev_fallback_secret_key_9999";
    const realToken = jwt.sign(userData, secret, { expiresIn: "7d" });

    res.json({
      status: "ok",
      token: realToken,
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
      user_key: u.user_key,
      email: u.email || null
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

/**
 * PATCH /api/users/profile
 */
const updateProfile = async (req, res) => {
  const { email } = req.body;
  const userId = req.user.id;

  try {
    const updated = await User.findByIdAndUpdate(
      userId,
      { email },
      { new: true, select: "-password" }
    );
    if (!updated) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    res.json({
      status: "ok",
      user: {
        id: updated._id.toString(),
        username: updated.username,
        role: updated.role,
        sensor_id: updated.sensor_id,
        user_key: updated.user_key,
        email: updated.email || null
      }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

module.exports = { signup, login, getUsers, deleteUser, updateProfile };
