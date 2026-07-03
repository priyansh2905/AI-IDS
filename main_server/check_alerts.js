const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const AlertSchema = new mongoose.Schema(
  {
    sensor_id: String,
    pid: Number,
    process_name: String,
    risk_score: Number,
    anomaly_score: Number,
    rule_hits: [String],
    rule_triggers: [String],
    classification: String,
    confidence: Number,
    explanation: String,
    status: String,
    timestamp: Date,
    acknowledged: Boolean,
    mitigation_status: String,
  },
  { collection: 'alerts' }
);

const Alert = mongoose.model('Alert', AlertSchema);

async function run() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const dbName = process.env.DATABASE_NAME || "hids_db";
  const fullUri = `${uri}/${dbName}`;

  console.log("Connecting to:", fullUri);
  try {
    await mongoose.connect(fullUri);
    console.log("Connected. Fetching alerts...");
    const count = await Alert.countDocuments();
    console.log("Total alerts count:", count);
    const alerts = await Alert.find().sort({ timestamp: -1 }).limit(5);
    console.log("Last 5 alerts:", JSON.stringify(alerts, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
