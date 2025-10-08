import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { z } from 'zod';
import {
  listInventoryQuerySchema,
  createAdjustSchema,
} from '../validators/inventory';
import {
  listInventory, // ✅ nombre correcto
  getMovementById, // ✅ nombre correcto
  createAdjust, // ✅ nombre correcto
  deleteAdjust, // ✅ nombre correcto
} from '../services/inventoryService';

const router = Router();

/**
 * GET /api/v1/inventory
 * ?q=arroz&type=IN&page=1&size=20&sort=date:desc
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const parsed = listInventoryQuerySchema.parse({
      ...req.query,
    });

    // sort viene como "campo:dir"
    const [sf = 'date', sd = 'desc'] = String(parsed.sort || 'date:desc').split(
      ':'
    );

    const out = await listInventory({
      q: parsed.q,
      type: parsed.type,
      page: parsed.page,
      size: parsed.size,
      sortField: sf as any,
      sortDir: sd === 'asc' ? 'asc' : 'desc',
      // from / to / productId / referenceType los puedes añadir luego al servicio
    });

    res.json(out);
  } catch (err: any) {
    console.error('inventory.list error:', err?.message, err?.stack);
    res
      .status(err?.status || 500)
      .json({ error: err?.message || 'Internal error' });
  }
});

/** GET /api/v1/inventory/:id */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const out = await getMovementById(id);
    res.json(out);
  } catch (err: any) {
    console.error('inventory.get error:', err?.message);
    res
      .status(err?.status || 500)
      .json({ error: err?.message || 'Internal error' });
  }
});

/** POST /api/v1/inventory  (AJUSTE IN/OUT) */
router.post('/', authenticate, async (req, res) => {
  try {
    const parsed = createAdjustSchema.parse(req.body);
    const out = await createAdjust(parsed);
    res.status(201).json(out);
  } catch (err: any) {
    console.error('inventory.createAdjust error:', err?.message);
    res
      .status(err?.status || 500)
      .json({ error: err?.message || 'Internal error' });
  }
});

/** DELETE /api/v1/inventory/:id  (Sólo AJUSTE) */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const out = await deleteAdjust(id);
    res.json(out);
  } catch (err: any) {
    console.error('inventory.deleteAdjust error:', err?.message);
    res
      .status(err?.status || 500)
      .json({ error: err?.message || 'Internal error' });
  }
});

export default router;
