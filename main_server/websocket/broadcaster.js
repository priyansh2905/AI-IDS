/**
 * websocket/broadcaster.js
 * Manages the WebSocket server and provides a broadcast() helper
 * that streams real-time updates to all connected frontend clients.
 *
 * The WS server is attached to the HTTP server in server.js via init().
 */

const WebSocket = require("ws");

/** Set of currently connected frontend WebSocket clients */
const frontendClients = new Set();

let wss = null;

/**
 * Initialises the WebSocket server on the given HTTP server instance.
 * @param {http.Server} httpServer
 */
const init = (httpServer) => {
  wss = new WebSocket.Server({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    console.log(`[+] Frontend WS client connected from ${req.socket.remoteAddress}`);
    frontendClients.add(ws);

    // Send handshake acknowledgement
    ws.send(JSON.stringify({ type: "connected", message: "AI-HIDS WebSocket stream active" }));

    ws.on("close", () => {
      frontendClients.delete(ws);
      console.log("[-] Frontend WS client disconnected.");
    });

    ws.on("error", (err) => {
      console.error(`[!] WS error: ${err.message}`);
      frontendClients.delete(ws);
    });
  });

  console.log("[+] WebSocket broadcaster initialised on path /ws");
};

/**
 * Broadcasts a JSON payload to all connected frontend clients.
 * @param {string} type - Message type (telemetry | alert | event | mitigation_status | alert_update)
 * @param {object} data - Payload data
 */
const broadcast = (type, data) => {
  if (!frontendClients.size) return;
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  for (const client of frontendClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
};

/**
 * Returns the number of currently connected frontend clients.
 */
const clientCount = () => frontendClients.size;

module.exports = { init, broadcast, clientCount };
