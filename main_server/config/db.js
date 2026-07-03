/**
 * config/db.js
 * MongoDB connection via Mongoose.
 * Call connectDB() once at startup in server.js.
 */

const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const dbName = process.env.DATABASE_NAME || "hids_db";
  const fullUri = `${uri}/${dbName}`;

  try {
    await mongoose.connect(fullUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[+] MongoDB connected → ${fullUri}`);
  } catch (err) {
    console.warn(`[!] MongoDB connection failed: ${err.message}`);
    console.warn("[!] Server will continue without MongoDB persistence.");
  }
};

module.exports = connectDB;
