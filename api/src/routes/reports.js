import { Router } from 'express';
import { z } from 'zod';
import Report from '../models/Report.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

const fotoZ = z.object({
  url: z.string().url(),
  nota: z.string().optional().default(''),
});

const reportZ = z.object({
  folio: z.string().optional(),           // se ignora en update, solo autogenerado
  fecha: z.string(),
  hora: z.string(),
  reportante: z.string().optional().default(''),
  area: z.string().optional().default(''),
  ubicacion: z.string().optional().default(''),
  tipo: z.string(),
  severidad: z.string(),
  descripcion: z.string().min(10),
  causas: z.string().optional().default(''),
  acciones: z.string().optional().default(''),
  responsable: z.string().optional().default(''),
  compromiso: z.string().optional().default(''),
  tags: z.string().optional().default(''),
  fotos: z.array(fotoZ).optional().default([]),
});

router.use(authRequired);

const pad2 = (n) => String(n).padStart(2, '0');

function toDateSafe(str) {
  if (typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

function toDDMMYY(str) {
  const d = toDateSafe(str);
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

async function nextFolioForDate(fechaStr) {
  const base = toDDMMYY(fechaStr);
  const prefix = `DESV-${base}-`;

  const [last] = await Report.aggregate([
    { $match: { folio: { $regex: `^${prefix}\\d{2,3}$` } } },
    {
      $addFields: {
        _suf: {
          $toInt: { $arrayElemAt: [{ $split: ['$folio', '-'] }, -1] },
        },
      },
    },
    { $sort: { _suf: -1 } },
    { $limit: 1 },
  ]);

  const next = last ? last._suf + 1 : 1;
  const pad = next >= 100 ? 3 : 2;
  return prefix + String(next).padStart(pad, '0');
}

function cleanFotos(arr = []) {
  return (arr || [])
    .filter((f) => f && typeof f.url === 'string' && /^https?:\/\//.test(f.url))
    .map((f) => ({ url: f.url, nota: f.nota || '' }));
}

// ========================= Rutas =========================

router.get('/next-folio', async (req, res) => {
  try {
    const fecha = (req.query.fecha || '').toString();
    const folio = await nextFolioForDate(fecha);
    res.json({ folio });
  } catch (e) {
    console.error('[GET /reports/next-folio] error:', e);
    res.status(500).json({ error: 'No se pudo calcular el folio' });
  }
});

router.get('/', async (req, res) => {
  const owner = req.query.owner;
  const q = (req.query.q || '').toString().trim();
  const filter = {};

  if (req.user.role !== 'admin') filter.ownerId = req.user.id;
  else if (owner === 'me') filter.ownerId = req.user.id;

  if (q) {
    filter.$or = [
      { folio: new RegExp(q, 'i') },
      { area: new RegExp(q, 'i') },
      { tipo: new RegExp(q, 'i') },
      { severidad: new RegExp(q, 'i') },
      { descripcion: new RegExp(q, 'i') },
      { ubicacion: new RegExp(q, 'i') },
      { ownerName: new RegExp(q, 'i') },
      { tags: new RegExp(q, 'i') },
    ];
  }

  const items = await Report.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(items);
});

router.post('/', async (req, res) => {
  const parsed = reportZ.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });

  const data = { ...parsed.data, fotos: cleanFotos(parsed.data.fotos) };

  let folio = (data.folio || '').trim();
  if (!folio) folio = await nextFolioForDate(data.fecha);

  for (let i = 0; i < 5; i++) {
    try {
      const item = await Report.create({
        ...data,
        folio,
        ownerId: req.user.id,
        ownerName: req.user.username,
      });
      return res.status(201).json(item);
    } catch (e) {
      if (e?.code === 11000 && e?.keyPattern?.folio) {
        folio = await nextFolioForDate(data.fecha);
        continue;
      }
      console.error('[POST /reports] error:', e);
      return res.status(500).json({ error: 'No se pudo crear' });
    }
  }
  return res.status(409).json({ error: 'No se pudo generar folio único, reintente' });
});

router.get('/:id', async (req, res) => {
  const it = await Report.findById(req.params.id);
  if (!it) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.role !== 'admin' && String(it.ownerId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(it);
});

router.put('/:id', async (req, res) => {
  const it = await Report.findById(req.params.id);
  if (!it) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.role !== 'admin' && String(it.ownerId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const parsed = reportZ.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });

  const data = { ...parsed.data, fotos: cleanFotos(parsed.data.fotos) };
  delete data.folio; // 🔒 impedir cambios de folio

  Object.assign(it, data);

  try {
    await it.save();
    res.json(it);
  } catch (e) {
    console.error('[PUT /reports/:id] error:', e);
    res.status(500).json({ error: 'No se pudo actualizar' });
  }
});

router.delete('/:id', async (req, res) => {
  const it = await Report.findById(req.params.id);
  if (!it) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.role !== 'admin' && String(it.ownerId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await it.deleteOne();
  res.json({ ok: true });
});

export default router;
