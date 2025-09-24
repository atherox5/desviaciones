import { Router } from 'express';
import { z } from 'zod';
import Report from '../models/Report.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

const fotoZ = z.object({ url: z.string().url(), nota: z.string().optional().default('') });
const reportZ = z.object({
  folio: z.string().optional(),  // se autogenera si falta
  fecha: z.string(),             // YYYY-MM-DD
  hora: z.string(),              // HH:mm
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
  sapAviso: z.string().optional().default(''),
  fotos: z.array(fotoZ).optional().default([]),
  status: z.enum(['pendiente','tratamiento','concluido']).optional() // opcional al crear
});

router.use(authRequired);

/* ---------- util folio ---------- */
const pad2 = n => String(n).padStart(2, '0');
function toDateSafe(s) {
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y, m-1, d);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
function toDDMMYY(s) {
  const d = toDateSafe(s);
  return `${pad2(d.getDate())}${pad2(d.getMonth()+1)}${String(d.getFullYear()).slice(-2)}`;
}
async function nextFolioForDate(fechaStr) {
  const base = toDDMMYY(fechaStr);
  const prefix = `DESV-${base}-`;
  const existing = await Report.find(
    { folio: { $regex: `^${prefix}` } },
    { folio: 1 }
  ).lean();

  const used = new Set();
  for (const item of existing) {
    const suf = (item.folio || '').slice(-2);
    const num = Number.parseInt(suf, 10);
    if (!Number.isNaN(num)) used.add(num);
  }

  for (let i = 1; i <= 99; i += 1) {
    if (!used.has(i)) {
      return `${prefix}${String(i).padStart(2, '0')}`;
    }
  }

  throw new Error('Correlativo agotado');
}

/* ---------- helpers ---------- */
function cleanFotos(arr = []) {
  return (arr || [])
    .filter(f => f && typeof f.url === 'string' && /^https?:\/\//.test(f.url))
    .map(f => ({ url: f.url, nota: f.nota || '' }));
}

// construye filtro por fecha (string "YYYY-MM-DD")
function buildDateFilter(q) {
  const filter = {};
  let from, to;

  if (q.day) {
    const d = toDateSafe(q.day);
    const y = d.getFullYear(), m = d.getMonth(), dd = d.getDate();
    from = `${y}-${pad2(m+1)}-${pad2(dd)}`;
    const d2 = new Date(y, m, dd+1);
    to = `${d2.getFullYear()}-${pad2(d2.getMonth()+1)}-${pad2(d2.getDate())}`;
  } else if (q.month) {
    // "YYYY-MM"
    const [y, m] = q.month.split('-').map(Number);
    if (y && m) {
      from = `${y}-${pad2(m)}-01`;
      const d2 = new Date(y, m, 1); // next month day 1
      to = `${d2.getFullYear()}-${pad2(d2.getMonth()+1)}-01`;
    }
  } else if (q.year) {
    const y = Number(q.year);
    if (y) {
      from = `${y}-01-01`;
      to = `${y+1}-01-01`;
    }
  } else if (q.from || q.to) {
    from = q.from;
    to = q.to;
  }

  if (from && to) filter.fecha = { $gte: from, $lt: to };
  return filter;
}

/* ---------- Endpoints ---------- */

// preview del próximo folio
router.get('/next-folio', async (req, res) => {
  const fecha = (req.query.fecha || '').toString();
  try {
    const folio = await nextFolioForDate(fecha);
    res.json({ folio });
  } catch (err) {
    res.status(409).json({ error: 'Sin correlativos disponibles' });
  }
});

// listado con filtros (owner/q/fecha/limit)
router.get('/', async (req, res) => {
  const owner = req.query.owner;
  const q = (req.query.q || '').toString().trim();
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const filter = buildDateFilter(req.query);

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

  const items = await Report.find(filter).sort({ createdAt: -1 }).limit(limit);
  res.json(items);
});

// crear (folio autogenerado si falta; status default 'pendiente')
router.post('/', async (req, res) => {
  const parsed = reportZ.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });

  const data = { ...parsed.data, fotos: cleanFotos(parsed.data.fotos) };
  if (!data.status) data.status = 'pendiente';

  let folio = (data.folio || '').trim();
  if (!folio) {
    try {
      folio = await nextFolioForDate(data.fecha);
    } catch (err) {
      return res.status(409).json({ error: 'Sin correlativos disponibles' });
    }
  }

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
        try {
          folio = await nextFolioForDate(data.fecha);
        } catch (err) {
          return res.status(409).json({ error: 'Sin correlativos disponibles' });
        }
        continue;
      }
      console.error('[POST /reports] error:', e);
      return res.status(500).json({ error: 'No se pudo crear' });
    }
  }
  return res.status(409).json({ error: 'No se pudo generar folio único, reintente' });
});

// obtener por id
router.get('/:id', async (req, res) => {
  const it = await Report.findById(req.params.id);
  if (!it) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.role !== 'admin' && String(it.ownerId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(it);
});

// actualizar (folio ineditable: se ignora si viene)
router.put('/:id', async (req, res) => {
  const it = await Report.findById(req.params.id);
  if (!it) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.role !== 'admin' && String(it.ownerId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const parsed = reportZ.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });

  const data = { ...parsed.data, fotos: cleanFotos(parsed.data.fotos) };
  delete data.folio;                        // <- folio NO se puede editar (nadie)
  if (data.status === undefined) delete data.status;

  Object.assign(it, data);

  try {
    await it.save();
    res.json(it);
  } catch (e) {
    console.error('[PUT /reports/:id] error:', e);
    res.status(500).json({ error: 'No se pudo actualizar' });
  }
});

// eliminar (dueño o admin)
router.delete('/:id', async (req, res) => {
  const it = await Report.findById(req.params.id);
  if (!it) return res.status(404).json({ error: 'No encontrado' });
  const isOwner = String(it.ownerId) === String(req.user.id);
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

  await it.deleteOne();
  res.json({ ok: true });
});

// cambiar estado (dueño o admin; transiciones válidas)
router.patch('/:id/status', async (req, res) => {
  const body = z.object({ status: z.enum(['pendiente','tratamiento','concluido']) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Estado inválido' });

  const it = await Report.findById(req.params.id);
  if (!it) return res.status(404).json({ error: 'No encontrado' });

  const isOwner = String(it.ownerId) === String(req.user.id);
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

  const from = it.status || 'pendiente';
  const to = body.data.status;
  const allowed = new Set([
    'pendiente->tratamiento',
    'pendiente->concluido',
    'tratamiento->concluido'
  ]);
  if (!allowed.has(`${from}->${to}`) && from !== to) {
    return res.status(400).json({ error: `Transición no permitida: ${from} → ${to}` });
  }

  it.status = to;
  await it.save();
  res.json({ ok: true, status: it.status });
});

// estadísticas (por rango de fecha)
router.get('/stats/summary', async (req, res) => {
  const filter = buildDateFilter(req.query);
  // dueños ven sólo lo suyo; admin ve todo
  if (req.user.role !== 'admin') filter.ownerId = req.user.id;

  const pipeline = [
    { $match: filter },
    { $addFields: { _status: { $ifNull: ['$status', 'pendiente'] } } },
    { $group: { _id: '$_status', count: { $sum: 1 } } }
  ];

  const rows = await Report.aggregate(pipeline);
  const by = { pendiente: 0, tratamiento: 0, concluido: 0 };
  let total = 0;
  for (const r of rows) {
    by[r._id] = r.count;
    total += r.count;
  }
  const compliance = total ? Math.round((by.concluido * 10000) / total) / 100 : 0;

  res.json({ total, byStatus: by, compliance }); // % cumplimiento = concluidos / total
});

export default router;
