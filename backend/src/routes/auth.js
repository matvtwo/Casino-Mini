import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import models, { sequelize } from '../db/index.js';
import { JWT_SECRET } from '../config.js';

const router = Router();

const buildToken = (user) =>
  jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res) => {
  const { username, password, avatarUrl } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Missing fields' });
  const existing = await models.User.findOne({ where: { username } });
  if (existing) return res.status(409).json({ message: 'Username taken' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await models.User.create({ username, passwordHash, avatarUrl });
  const token = buildToken(user);
  res.json({ token, user: { id: user.id, username: user.username, balance: user.balance, avatarUrl } });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Missing fields' });
  const user = await models.User.findOne({ where: { username } });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  const token = buildToken(user);
  res.json({ token, user: { id: user.id, username: user.username, balance: user.balance, avatarUrl: user.avatarUrl } });
});

export const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'No token' });
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await models.User.findByPk(payload.id);
    if (!user) throw new Error('User missing');
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

router.get('/me', authMiddleware, async (req, res) => {
  const { id, username, balance, avatarUrl } = req.user;
  res.json({ id, username, balance, avatarUrl });
});

router.post('/seed-reset', async (_req, res) => {
  await sequelize.sync({ force: true });
  res.json({ message: 'db reset' });
});

export default router;

