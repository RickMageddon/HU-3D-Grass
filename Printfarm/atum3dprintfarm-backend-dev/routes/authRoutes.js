const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");
const verifyToken = require("../middleware/auth");
const isAdmin = require("../middleware/isAdmin");

const router = express.Router();

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("JWT_SECRET is required");
  return secret;
}

// ----------------------------
// SIGNUP
// ----------------------------
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  const existing = userModel.findByEmail(email);
  if (existing) return res.status(400).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 10);

  const user = userModel.create(name, email, passwordHash, "user");

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: "24h" }
  );

  res.json({ token, user });
});

// ----------------------------
// LOGIN
// ----------------------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = userModel.findByEmail(email);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: "24h" }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

// ----------------------------
// GET all users (admin only)
// ----------------------------
router.get("/users", verifyToken, isAdmin, (req, res) => {
  try {
    const users = userModel.getAll();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: "Failed to load users" });
  }
});

// ----------------------------
// PUT update user (admin only)
// ----------------------------
router.put("/users/:id", verifyToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const { name, email, role } = req.body;

  try {
    const updatedUser = userModel.update(id, { name, email, role });
    res.json({ user: updatedUser });
  } catch (err) {
    res.status(500).json({ message: "Failed to update user" });
  }
});

// ----------------------------
// DELETE user (admin only)
// ----------------------------
router.delete("/users/:id", verifyToken, isAdmin, (req, res) => {
  const { id } = req.params;

  try {
    userModel.delete(id);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user" });
  }
});

module.exports = router;
