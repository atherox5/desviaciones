import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User from '../models/User.js';
import { authRequired, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authRequired, requireAdmin);

router.get('/', async (req, res) => {
  const users = await User.find({}, { username: 1, role: 1, createdAt: 1, updatedAt: 1 }).sort({ createdAt: 1 });
  res.json(users.map((u) => ({ id: u._id, username: u.username, role: u.role, createdAt: u.createdAt, updatedAt: u.updatedAt })));
});

const updateSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  role: z.enum(['admin', 'user']).optional(),
  password: z.string().min(6).max(200).optional(),
}).refine((data) => Boolean(data.username || data.role || data.password), {
  message: 'Nada para actualizar',
});

router.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues?.[0]?.message || 'Datos inválidos' });

  const { username, role, password } = parsed.data;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (username && username !== user.username) {
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ error: 'Nombre de usuario en uso' });
    user.username = username;
  }

  if (role && role !== user.role) {
    if (String(user._id) === String(req.user.id) && role !== 'admin') {
      return res.status(400).json({ error: 'No puedes quitarte rol de admin a ti mismo' });
    }
    user.role = role;
  }

  if (password) {
    user.passHash = await bcrypt.hash(password, 12);
  }

  await user.save();
  res.json({ id: user._id, username: user.username, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt });
});

export default router;
