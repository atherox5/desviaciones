import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User from '../models/User.js';
import { authRequired, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authRequired);

const photoSchema = z.string().max(1000).regex(/^$|^https?:\/\/|^data:/, 'URL de foto inválida');

const profileSchema = z.object({
  fullName: z.string().min(3).max(120).optional(),
  photoUrl: photoSchema.optional(),
}).refine((data) => Boolean(data.fullName || data.photoUrl !== undefined), {
  message: 'Nada para actualizar',
});

router.patch('/me', async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues?.[0]?.message || 'Datos inválidos' });

  const { fullName, photoUrl } = parsed.data;
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (typeof fullName === 'string') user.fullName = fullName;
  if (typeof photoUrl === 'string') user.photoUrl = photoUrl;

  await user.save();
  res.json({ id: user._id, username: user.username, role: user.role, fullName: user.fullName || '', photoUrl: user.photoUrl || '', updatedAt: user.updatedAt });
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6).max(200),
  newPassword: z.string().min(6).max(200),
});

router.patch('/me/password', async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
  const { currentPassword, newPassword } = parsed.data;
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const ok = await bcrypt.compare(currentPassword, user.passHash);
  if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

  user.passHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.json({ ok: true });
});

router.use(requireAdmin);

const createSchema = z.object({
  username: z.string().min(3).max(50),
  fullName: z.string().min(3).max(120),
  password: z.string().min(6).max(200),
  role: z.enum(['admin', 'user']).default('user').optional(),
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues?.[0]?.message || 'Datos inválidos' });
  const { username, fullName, password, role = 'user' } = parsed.data;
  const exists = await User.findOne({ username });
  if (exists) return res.status(409).json({ error: 'Nombre de usuario en uso' });

  const passHash = await bcrypt.hash(password, 12);
  const user = await User.create({ username, fullName, passHash, role });
  res.status(201).json({ id: user._id, username: user.username, fullName: user.fullName || '', role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt });
});

router.get('/', async (req, res) => {
  const users = await User.find({}, { username: 1, role: 1, fullName: 1, photoUrl: 1, createdAt: 1, updatedAt: 1 }).sort({ createdAt: 1 });
  res.json(users.map((u) => ({ id: u._id, username: u.username, fullName: u.fullName || '', photoUrl: u.photoUrl || '', role: u.role, createdAt: u.createdAt, updatedAt: u.updatedAt })));
});

const updateSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  fullName: z.string().min(3).max(120).optional(),
  photoUrl: photoSchema.optional(),
  role: z.enum(['admin', 'user']).optional(),
  password: z.string().min(6).max(200).optional(),
}).refine((data) => Boolean(data.username || data.fullName || data.photoUrl !== undefined || data.role || data.password), {
  message: 'Nada para actualizar',
});

router.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues?.[0]?.message || 'Datos inválidos' });

  const { username, fullName, photoUrl, role, password } = parsed.data;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (username && username !== user.username) {
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ error: 'Nombre de usuario en uso' });
    user.username = username;
  }

  if (typeof fullName === 'string') user.fullName = fullName;
  if (typeof photoUrl === 'string') user.photoUrl = photoUrl;

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
  res.json({ id: user._id, username: user.username, fullName: user.fullName || '', photoUrl: user.photoUrl || '', role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt });
});

router.delete('/:id', async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  await user.deleteOne();
  res.json({ ok: true });
});

export default router;
