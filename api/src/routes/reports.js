// api/src/routes/reports.js
import { Router } from 'express';
import { z } from 'zod';
import Report from '../models/Report.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

const fotoZ = z.object({
  url: z.string().url(), // http/https
  nota: z.string().optional().default(''),
});

const reportZ = z.object({
  folio: z.string().optional(),           // -> se autogenera si falta o colisiona
  fecha: z.string(),                      // YYYY-MM-DD
  hora: z.string(),                       // HH:mm
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

/* ========================= Helpers ========================= */
const pad2 = (n) => String(n).padStart(2, '0');

function toDateSafe(str) {
  // Acepta "YYYY-MM-DD" o cae a hoy
  if (typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

// ddmmyy (ej: 25-09-23 -> "250923")
function toDDMMYY(str) {
  const d = toDateSafe(str);
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

// Calcula el siguiente folio para la fecha dada, buscando el mayor sufijo numérico.
// Soporta sufijos de 2 o 3 dígitos (01..99..100..)
async function nextFolioForDate(fechaStr) {
  const base = toDDMMYY(fechaStr);
  const prefix = `DESV-${base}-`;

  // Agregación: extrae sufijo numérico y obtiene el máximo
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

// Limpia y normaliza array de fotos
function cleanFotos(arr = []) {
  return (arr || [])
    .filter((f) => f && typeof f.url === 'string' && /^https?:\/\//.test(f.url))
    .map((f) => ({ url: f.url, nota: f.nota || '' }));
}

/* ========================= Rutas ========================= */

// (Opcional) Previsualizar próximo folio para una fecha dada
// GET /api/reports/next-folio?fecha=YYYY-MM-DD
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

// Listado con filtros básicos
// GET /api/reports?owner=me|all&q=texto
router.get('/', async (req, res) => {
  const owner = req.query.owner;
  const q = (req.query.q || '').toString().trim();
  const filter = {};

  // Convencional solo ve los propios; admin puede ver todos o "me"
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

// Crear (autogenera folio si falta o colisiona)
router.post('/', async (req, res) => {
  const parsed = reportZ.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });

  const data = { ...parsed.data, fotos: cleanFotos(parsed.data.fotos) };

  let folio = (data.folio || '').trim();
  if (!folio) folio = await nextFolioForDate(data.fecha);

  // Reintentos por colisiones de índice único (concurrencia)
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
      // 11000 = duplicate key (folio único)
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

// Obtener por id
router.get('/:id', async (req, res) => {
  const it = await Report.findById(req.params.id);
  if (!it) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.role !== 'admin' && String(it.ownerId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(it);
});

// Actualizar (si cambian folio y choca, asigna el siguiente de la fecha)
router.put('/:id', async (req, res) => {
  const it = await Report.findById(req.params.id);
  if (!it) return res.status(404).json({ error: 'No encontrado' });
  if (req.user.role !== 'admin' && String(it.ownerId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const parsed = reportZ.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });

  const data = { ...parsed.data, fotos: cleanFotos(parsed.data.fotos) };

  // Si viene un folio diferente y ya existe en otro doc, reasigna al siguiente
  if (data.folio && data.folio !== it.folio) {
    const exists = await Report.findOne({ folio: data.folio, _id: { $ne: it._id } });
    if (exists) data.folio = await nextFolioForDate(data.fecha || it.fecha);
  }

  Object.assign(it, data);

  try {
    await it.save();
    res.json(it);
  } catch (e) {
    if (e?.code === 11000 && e?.keyPattern?.folio) {
      // Último salvavidas: si chocó, generamos otro y guardamos
      it.folio = await nextFolioForDate(it.fecha);
      await it.save();
      return res.json(it);
    }
    console.error('[PUT /reports/:id] error:', e);
    res.status(500).json({ error: 'No se pudo actualizar' });
  }
});

// Eliminar
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
