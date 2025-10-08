import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { z } from 'zod';
import {
  createPurchaseSchema,
  addPurchasePaymentSchema,
} from '../validators/purchase';
import {
  createPurchaseTx,
  addPurchasePaymentTx,
  getPurchaseById,
  listPurchases,
} from '../services/purchaseService';

const router = Router();

// Listado con búsqueda/paginación
router.get('/', authenticate, async (req, res, next) => {
  try {
    const q = String(req.query.q || '');
    const page = Number(req.query.page || 1);
    const size = Number(req.query.size || 10);
    const sort = String(req.query.sort || 'createdAt:desc');

    const out = await listPurchases({ q, page, size, sort });
    res.json(out);
  } catch (err) {
    next(err);
  }
});

// Detalle
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const purchase = await getPurchaseById(id);
    if (!purchase) return res.status(404).json({ error: 'No encontrada' });
    res.json(purchase);
  } catch (err) {
    next(err);
  }
});

// Crear compra
router.post('/', authenticate, async (req, res, next) => {
  try {
    const parsed = createPurchaseSchema.parse(req.body);
    const created = await createPurchaseTx({
      supplierId: parsed.supplierId,
      currency: parsed.currency as any,
      rateSource: parsed.rateSource as any,
      manualRate: parsed.manualRate,
      items: parsed.items,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// Abonar / registrar pago
router.post('/:id/payments', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const parsed = addPurchasePaymentSchema.parse(req.body);
    const updated = await addPurchasePaymentTx({
      purchaseId: id,
      method: parsed.method as any,
      currency: parsed.currency as any,
      amount: parsed.amount,
      note: parsed.note,
      rateSource: parsed.rateSource as any,
      manualRate: parsed.manualRate,
    });
    res.status(201).json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
