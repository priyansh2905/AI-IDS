/**
 * middleware/authMiddleware.js
 * Express middleware to verify JWT tokens from the Authorization header.
 */

const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  // 1. Get the Authorization header
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: "error",
      message: "Access denied. No authentication token provided."
    });
  }

  // 2. Extract the token
  const token = authHeader.split(" ")[1];

  try {
    // 3. Verify the token using the secret
    const secret = process.env.JWT_SECRET || "dev_fallback_secret_key_9999";
    const decoded = jwt.verify(token, secret);

    // 4. Attach the decoded user data to req.user
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired authentication token."
    });
  }
};

module.exports = authMiddleware;
