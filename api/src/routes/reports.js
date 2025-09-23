import { Router } from 'express';
import { z } from 'zod';
import Report from '../models/Report.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

const fotoZ = z.object({
  url: z.string().url(),           // http/https
  nota: z.string().optional().default(''),
});

const reportZ = z.object({
  folio: z.string().min(5).optional(),       // ahora opcional (lo autogeneramos si falta)
  fecha: z.string(),                          // YYYY-MM-DD
  hora: z.string(),                           // HH:mm
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

/* ------------------------- utilidades folio ------------------------- */
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
function ddmmyy(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

async function nextFolio(fecha) {
  const base = ddmmyy(fecha); // p.ej. 250923
  const rx = new RegExp(`^DESV-${base}-\\d{2}$`);
  const last = await Report.find({ folio: { $regex: rx } })
    .sort({ folio: -1 })
    .limit(1);
  let seq = 1;
  if (last.length) {
    const n = parseInt(last[0].folio.split('-').pop(), 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }
  return `DESV-${base}-${String(seq).padStart(2, '0')}`;
}

/* ------------------------- helpers ------------------------- */
function cleanFotos(arr = []) {
  return (arr || [])
    .filter((f) => f && typeof f.url === 'string' && /^https?:\/\//.test(f.url))
    .map((f) => ({ url: f.url, nota: f.nota || '' }));
}

/* ---------------------------- RUTAS ---------------------------- */

// GET /api/reports?owner=me|all&q=texto
router.get('/', async (req, res) => {
  const owner = req.query.owner;
  const q = (req.query.q || '').toString().trim();
  const filter = {};

  if (req.user.role !== 'admin') {
    filter.ownerId = req.user.id;
  } else if (owner === 'me') {
    filter.ownerId = req.user.id;
  }

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

// POST /api/reports  (crea con folio único)
router.post('/', async (req, res) => {
  const parsed = reportZ.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });

  // normaliza fotos y folio
  const data = { ...parsed.data, fotos: cleanFotos(parsed.data.fotos) };

  // genera folio si falta o si choca
  let folio = data.folio;
  if (!folio) {
    folio = await nextFolio(data.fecha);
  } else {
    const exists = await Report.exists({ folio });
    if (exists) folio = await nextFolio(data.fecha);
  }

  // intenta crear; si hay carrera por folio, recalcula y reintenta
  for (let i = 0; i < 3; i++) {
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
        folio = await nextFolio(data.fecha);
        continue;
      }
      console.error('[POST /reports] error:', e);
      return res.status(500).json({ error: 'No se pudo crear' });
    }
  }
  return res.status(500).json({ error: 'No se pudo generar folio único' });
});

// GET /api/reports/:id
router.get('/:id', async (req, res) => {
  const it = await Report.findById(req.params.id);
  if (!it) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.role !== 'admin' && String(it.ownerId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(it);
});

// PUT /api/reports/:id  (actualiza; si cambian folio y choca, asigna el siguiente)
router.put('/:id', async (req, res) => {
  const it = await Report.findById(req.params.id);
  if (!it) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.role !== 'admin' && String(it.ownerId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const parsed = reportZ.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });

  const data = { ...parsed.data, fotos: cleanFotos(parsed.data.fotos) };

  // si el folio cambió y existe en otro doc, asigna el siguiente
  if (data.folio && data.folio !== it.folio) {
    const exists = await Report.findOne({ folio: data.folio, _id: { $ne: it._id } });
    if (exists) {
      data.folio = await nextFolio(data.fecha);
    }
  }

  Object.assign(it, data);

  try {
    await it.save();
    return res.json(it);
  } catch (e) {
    if (e?.code === 11000 && e?.keyPattern?.folio) {
      // último salvavidas: recalcula y guarda
      it.folio = await nextFolio(it.fecha);
      await it.save();
      return res.json(it);
    }
    console.error('[PUT /reports/:id] error:', e);
    return res.status(500).json({ error: 'No se pudo actualizar' });
  }
});

// DELETE /api/reports/:id
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
