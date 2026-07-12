/**
 * server.js — AI-HIDS Express Main Server (Entry Point)
 * =======================================================
 * Responsibilities:
 *  - Load env vars
 *  - Connect to MongoDB
 *  - Mount middleware
 *  - Mount routes (public API + internal)
 *  - Initialise WebSocket broadcaster
 *  - Start HTTP server
 *
 * All business logic lives in /controllers, /models, /routes, /websocket.
 */

require("dotenv").config({ path: "../.env" });

const express = require("express");
const cors    = require("cors");
const http    = require("http");

const connectDB   = require("./config/db");
const broadcaster = require("./websocket/broadcaster");
const apiRoutes   = require("./routes/api");
const internalRoutes = require("./routes/internal");

// ─────────────────────────────────────────────
// App & HTTP server
// ─────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

const PORT = process.env.EXPRESS_PORT || 8000;

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Lightweight request logger (skip internal noise)
app.use((req, _res, next) => {
  if (!req.path.startsWith("/api/internal")) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
app.use("/api/internal", internalRoutes); // FastAPI → Express (data ingest)
app.use("/api",          apiRoutes);      // Frontend → Express (public API)

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("[!] Unhandled error:", err);
  res.status(500).json({ status: "error", message: err.message });
});

// ─────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────
const start = async () => {
  // 1. MongoDB
  await connectDB();

  // 2. WebSocket broadcaster (attaches to HTTP server)
  broadcaster.init(server);

  // 3. Listen
  server.listen(PORT, "127.0.0.1", () => {
    console.log("=============================================");
    console.log("   AI-HIDS Express.js Main Server           ");
    console.log("=============================================");
    console.log(`[+] HTTP API  →  http://127.0.0.1:${PORT}/api/health`);
    console.log(`[+] WebSocket →  ws://127.0.0.1:${PORT}/ws`);
    console.log("=============================================");
  });
};

start();
