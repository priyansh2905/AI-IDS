/**
 * config/db.js
 * MongoDB connection via Mongoose.
 * Call connectDB() once at startup in server.js.
 */

const mongoose = require("mongoose");

const User = require("../models/User");

const seedDefaultUsers = async () => {
  try {
    const defaults = [
      { username: "admin", password: "admin", role: "admin", sensor_id: null },
      { username: "type1", password: "type1", role: "type-1", sensor_id: null },
      { username: "type2", password: "type2", role: "type-2", sensor_id: "sensor-windows-testing" }
    ];

    for (const def of defaults) {
      const exists = await User.findOne({ username: def.username });
      if (!exists) {
        await User.create(def);
        console.log(`[*] Seeded default developer credential: ${def.username}`);
      }
    }
  } catch (e) {
    console.warn(`[!] Failed to seed default credentials: ${e.message}`);
  }
};

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const dbName = process.env.DATABASE_NAME || "hids_db";
  const fullUri = `${uri}/${dbName}`;

  mongoose.connection.on("connected", () => {
    console.log(`[+] MongoDB connection established successfully to database: ${dbName}`);
  });

  mongoose.connection.on("error", (err) => {
    console.error(`[!] MongoDB connection error: ${err.message}`);
  });

  try {
    await mongoose.connect(fullUri, {
      serverSelectionTimeoutMS: 5000,
    });
    await seedDefaultUsers();
  } catch (err) {
    console.warn(`[!] MongoDB initial connection failed: ${err.message}`);
    console.warn("[!] Server will continue without MongoDB persistence.");
  }
};

module.exports = connectDB;
