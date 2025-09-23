import jwt from 'jsonwebtoken';
import { env } from '../config.js';

export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '30m' });
}
export function signRefreshToken(payload) {
  return jwt.sign(payload, env.REFRESH_JWT_SECRET, { expiresIn: '7d' });
}

export function authRequired(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded; // { id, username, role }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Helper opcional si quisieras reutilizar en algunos endpoints
export function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ error: 'Admin only' });
}
