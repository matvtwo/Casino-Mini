const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../../db/models");
const { User } = db;
const { JWT_SECRET, ADMIN_SECRET } = require("../config");

const router = express.Router();

function buildToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

router.post("/register", async (req, res) => {
  try {
    const { username, password, avatarUrl, adminKey } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(409).json({ message: "Username taken" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const role =
      adminKey && ADMIN_SECRET && adminKey === ADMIN_SECRET
        ? "admin"
        : "player";
    const user = await User.create({ username, passwordHash, avatarUrl, role });
    const token = buildToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        balance: user.balance,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = buildToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        balance: user.balance,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Login failed" });
  }
});

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ message: "No token" });
  }

  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(payload.id);
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

router.get("/me", authMiddleware, (req, res) => {
  const { id, username, balance, avatarUrl } = req.user;
  const { role } = req.user;
  return res.json({ id, username, balance, avatarUrl, role });
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
module.exports.requireAdmin = function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  return next();
};
