/* ═══════════════════════════════════════════════════
   JWT Authentication Middleware
   Verifies Bearer token and attaches req.user
   ═══════════════════════════════════════════════════ */

const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");

/**
 * Express middleware: extracts and verifies JWT from Authorization header.
 * On success, sets req.user = { id, username, email }.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Provide Bearer token.",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Provided token format is invalid.",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
    };
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

module.exports = { authenticate };
