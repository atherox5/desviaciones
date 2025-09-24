import { Router } from 'express';
import { z } from 'zod';
import ShiftSummary from '../models/ShiftSummary.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.use(authRequired);

const fotoZ = z.object({ url: z.string().url(), nota: z.string().optional().default('') });
const summaryZ = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  area: z.string().min(2),
  ubicacion: z.string().optional().default(''),
  novedades: z.string().min(3),
  fotos: z.array(fotoZ).optional().default([]),
});

const updateSummaryZ = summaryZ.partial().refine((data) =>
  Boolean(
    data.fecha !== undefined ||
    data.area !== undefined ||
    data.ubicacion !== undefined ||
    data.novedades !== undefined ||
    data.fotos !== undefined
  ),
{ message: 'Nada para actualizar' });

function cleanFotos(arr = []) {
  return (arr || [])
    .filter(f => f && typeof f.url === 'string' && /^https?:\/\//.test(f.url))
    .map(f => ({ url: f.url, nota: f.nota || '' }));
}

function buildDateFilter(query = {}) {
  const filter = {};
  const from = query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from) ? query.from : null;
  const to = query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to) ? query.to : null;
  if (from && to) filter.fecha = { $gte: from, $lte: to };
  else if (from) filter.fecha = { $gte: from };
  else if (to) filter.fecha = { $lte: to };
  return filter;
}

router.get('/', async (req, res) => {
  const filter = buildDateFilter(req.query);
  const isAdmin = (req.user.role || '').toLowerCase() === 'admin';
  if (!isAdmin || req.query.owner === 'me') {
    filter.ownerId = req.user.id;
  } else if (req.query.owner) {
    filter.ownerId = req.query.owner;
  }

  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const items = await ShiftSummary.find(filter).sort({ fecha: -1, createdAt: -1 }).limit(limit);

  const ownerIds = [...new Set(items.map((it) => String(it.ownerId)))];
  const users = await User.find({ _id: { $in: ownerIds } }, { fullName: 1, username: 1 }).lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const payload = items.map((it) => {
    const obj = it.toObject();
    const user = userMap.get(String(it.ownerId));
    if (user) {
      obj.ownerFullName = user.fullName || user.username;
      if (!obj.ownerName) obj.ownerName = user.fullName || user.username;
    }
    return obj;
  });

  res.json(payload);
});

router.post('/', async (req, res) => {
  const parsed = summaryZ.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });

  const data = { ...parsed.data, fotos: cleanFotos(parsed.data.fotos) };
  try {
    const item = await ShiftSummary.create({
      ...data,
      ownerId: req.user.id,
      ownerName: req.user.fullName?.trim() ? req.user.fullName : req.user.username,
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('[POST /summaries] error:', e);
    res.status(500).json({ error: 'No se pudo crear' });
  }
});

router.patch('/:id', async (req, res) => {
  const item = await ShiftSummary.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  const isOwner = String(item.ownerId) === String(req.user.id);
  const isAdmin = (req.user.role || '').toLowerCase() === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

  const parsed = updateSummaryZ.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues?.[0]?.message || 'Datos inválidos' });

  const data = parsed.data;
  if (data.fotos) data.fotos = cleanFotos(data.fotos);

  Object.assign(item, data);

  try {
    await item.save();
    res.json(item);
  } catch (e) {
    console.error('[PATCH /summaries/:id] error:', e);
    res.status(500).json({ error: 'No se pudo actualizar la novedad' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const item = await ShiftSummary.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    const isOwner = String(item.ownerId) === String(req.user.id);
    const isAdmin = (req.user.role || '').toLowerCase() === 'admin';
    if (process.env.NODE_ENV !== 'production') {
      console.log('[DELETE /summaries/:id]', {
        userId: req.user.id,
        role: req.user.role,
        ownerId: String(item.ownerId),
        isOwner,
        isAdmin,
      });
    }
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    await ShiftSummary.findByIdAndDelete(item._id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /summaries/:id] error:', err);
    res.status(500).json({ error: 'No se pudo eliminar la novedad' });
  }
});

export default router;
