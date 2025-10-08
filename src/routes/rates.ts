import { Router } from 'express';
import { getRate } from '../services/rateProvider';

const router = Router();

// Endpoint GET /api/v1/rates/current?source=bcv|manual&value=xx
router.get('/current', async (req, res, next) => {
  try {
    const source = (req.query.source as string) || 'bcv';
    const manualValue = req.query.value ? Number(req.query.value) : undefined;

    const rate = await getRate(source as any, manualValue);
    res.json({ source, rate, updatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('Error obteniendo tasa:', err.message);
    res.status(500).json({ error: err.message || 'Error interno' });
  }
});

export default router;
