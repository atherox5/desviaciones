import { Router } from 'express';
import crypto from 'node:crypto';
import { env } from '../config.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// Protegida: requiere login (tu front ya envía Bearer)
router.use(authRequired);

// Firma para subida directa a Cloudinary (client-side)
router.post('/signature', (req, res) => {
  const { timestamp, folder } = req.body || {};
  const ts = Number(timestamp);
  if (!ts || !folder) {
    return res.status(400).json({ error: 'timestamp y folder son requeridos' });
  }

  // string a firmar: claves en orden alfabético
  const stringToSign = `folder=${folder}&timestamp=${ts}`;
  const signature = crypto
    .createHash('sha1')
    .update(stringToSign + env.CLOUDINARY_API_SECRET)
    .digest('hex');

  return res.json({
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    signature,
    timestamp: ts,    // útil si quieres consumir el mismo valor desde el front
    folder           // el front lo reusa al subir
  });
});

export default router;

