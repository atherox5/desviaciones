import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User from '../models/User.js';
import { env } from '../config.js';
import { signAccessToken, signRefreshToken } from '../middleware/auth.js';

const router = Router();

const credSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(200),
});
const setupSchema = credSchema.extend({
  fullName: z.string().min(3).max(120).optional(),
});

function toUserPayload(user) {
  return {
    id: user._id,
    username: user.username,
    role: user.role,
    fullName: user.fullName || '',
    photoUrl: user.photoUrl || '',
  };
}

const refreshCookieOptions = Object.freeze({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  path: '/api/auth',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});

// Primer admin si no hay usuarios
router.post('/setup-admin', async (req, res) => {
  const count = await User.countDocuments();
  if (count > 0) return res.status(400).json({ error: 'Ya existe al menos un usuario' });
  const parsed = setupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
  const { username, password, fullName } = parsed.data;
  const passHash = await bcrypt.hash(password, 12);
  const user = await User.create({ username, passHash, role: 'admin', fullName: fullName || username });
  const access = signAccessToken({ id: user._id, username: user.username, role: user.role, fullName: user.fullName || '', photoUrl: user.photoUrl || '' });
  const refresh = signRefreshToken({ id: user._id });
  res.cookie('refreshToken', refresh, refreshCookieOptions);
  res.json({ user: toUserPayload(user), access });
});

router.post('/register', async (req, res) => {
  return res.status(403).json({ error: 'Registro cerrado' });
});

router.post('/login', async (req, res) => {
  const parsed = credSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
  const { username, password } = parsed.data;
  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ error: 'Credenciales' });
  const ok = await bcrypt.compare(password, user.passHash);
  if (!ok) return res.status(401).json({ error: 'Credenciales' });
  const access = signAccessToken({ id: user._id, username: user.username, role: user.role, fullName: user.fullName || '', photoUrl: user.photoUrl || '' });
  const refresh = signRefreshToken({ id: user._id });
  res.cookie('refreshToken', refresh, refreshCookieOptions);
  res.json({ user: toUserPayload(user), access });
});

router.get('/status', async (req, res) => {
  const total = await User.countDocuments();
  res.json({ usersExist: total > 0 });
});

router.post('/refresh', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'No refresh' });
  try {
    const jwt = await import('jsonwebtoken');
    const { id } = jwt.default.verify(token, env.REFRESH_JWT_SECRET);
    const user = await User.findById(id);
    if (!user) return res.status(401).json({ error: 'Usuario no existe' });
    const payload = toUserPayload(user);
    const access = signAccessToken({ id: user._id, username: user.username, role: user.role, fullName: user.fullName || '', photoUrl: user.photoUrl || '' });
    res.json({ access, user: payload });
  } catch (e) {
    return res.status(401).json({ error: 'Refresh inválido' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', refreshCookieOptions);
  res.json({ ok: true });
});

export default router;
