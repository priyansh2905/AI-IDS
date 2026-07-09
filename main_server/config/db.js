/**
 * config/db.js
 * MongoDB connection via Mongoose.
 * Call connectDB() once at startup in server.js.
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Group = require("../models/Group");

const seedDefaultUsers = async () => {
  try {
    const defaults = [
      { username: "admin", password: "admin", role: "admin", sensor_id: null, user_key: "key-admin-1111" },
      { username: "type1", password: "type1", role: "type-1", sensor_id: null, user_key: "key-type1-2222" },
      { username: "type2", password: "type2", role: "type-2", sensor_id: "sensor-windows-testing", user_key: "key-type2-3333" }
    ];

    for (const def of defaults) {
      const exists = await User.findOne({ username: def.username });
      const hashedPassword = await bcrypt.hash(def.password, 10);
      if (!exists) {
        await User.create({
          ...def,
          password: hashedPassword
        });
        console.log(`[*] Seeded default developer credential: ${def.username}`);
      } else {
        let needsSave = false;
        if (!exists.user_key) {
          exists.user_key = def.user_key;
          needsSave = true;
        }
        if (!exists.password.startsWith("$2a$") && !exists.password.startsWith("$2b$")) {
          exists.password = hashedPassword;
          needsSave = true;
        }
        if (needsSave) {
          await exists.save();
          console.log(`[*] Updated default developer credential: ${def.username}`);
        }
      }
    }
  } catch (e) {
    console.warn(`[!] Failed to seed default credentials: ${e.message}`);
  }
};

const seedDefaultGroups = async () => {
  try {
    const adminUser = await User.findOne({ username: "admin" });
    const type1User = await User.findOne({ username: "type1" });
    const type2User = await User.findOne({ username: "type2" });

    if (adminUser && type1User && type2User) {
      const exists = await Group.findOne({ name: "Alpha Response Force" });
      if (!exists) {
        await Group.create({
          name: "Alpha Response Force",
          creator_id: adminUser._id,
          members: [adminUser._id, type1User._id, type2User._id],
          pending_requests: [],
          pending_invitations: [],
          group_key: "grp-alpha-1111",
          status: "public"
        });
        console.log("[*] Seeded default group: Alpha Response Force");
      }
    }
  } catch (e) {
    console.warn(`[!] Failed to seed default group: ${e.message}`);
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
      tlsAllowInvalidCertificates: true
    });
    await seedDefaultUsers();
    await seedDefaultGroups();
  } catch (err) {
    console.warn(`[!] MongoDB initial connection failed: ${err.message}`);
    console.warn("[!] Server will continue without MongoDB persistence.");
  }
};

module.exports = connectDB;
