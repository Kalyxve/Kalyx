import { Router } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { z } from 'zod';
import {
  createSaleService,
  addPaymentTx,
  voidSaleTx,
} from '../services/saleService';
import { prisma } from '../index';

// ====== VALIDADORES (Zod) ======
const createSaleSchema = z.object({
  clientId: z.number().optional(),
  currency: z.enum(['USD', 'BS']),
  rateSource: z.enum(['bcv', 'manual']),
  manualRate: z.number().optional(),
  overrideNote: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.number(),
        quantity: z.number().positive(),
        unitPrice: z.number().optional(),
        isFree: z.boolean().optional(),
      })
    )
    .min(1, 'Debe agregar al menos un producto.'),
  initialPayments: z
    .array(
      z.object({
        method: z.enum([
          'CASH_BS',
          'CASH_USD',
          'DEBIT_CARD',
          'PAGO_MOVIL',
          'TRANSFER_BS',
          'TRANSFER_USD',
        ]),
        currency: z.enum(['USD', 'BS']),
        amount: z.number().positive(),
        note: z.string().optional(),
      })
    )
    .optional(),
});

const addPaymentSchema = z.object({
  method: z.enum([
    'CASH_BS',
    'CASH_USD',
    'DEBIT_CARD',
    'PAGO_MOVIL',
    'TRANSFER_BS',
    'TRANSFER_USD',
  ]),
  currency: z.enum(['USD', 'BS']),
  amount: z.number().positive(),
  note: z.string().optional(),
  rateSource: z.enum(['bcv', 'manual']),
  manualRate: z.number().optional(),
});

// ====== ROUTER ======
const router = Router();

// ---------- LISTAR VENTAS ----------
router.get('/', authenticate, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const page = Number(req.query.page || 1);
    const size = Math.min(Number(req.query.size || 10), 100);
    const [sortField = 'createdAt', sortDir = 'desc'] = String(
      req.query.sort || 'createdAt:desc'
    ).split(':');

    const where = q
      ? {
          OR: [
            { invoiceNumber: { contains: q } },
            { client: { name: { contains: q } } },
          ],
        }
      : {};

    const [rows, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          client: true,
          seller: true,
          items: { include: { product: true } },
          payments: true,
        },
        orderBy: { [sortField]: sortDir === 'asc' ? 'asc' : 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.sale.count({ where }),
    ]);

    res.json({ rows, total, page, size });
  } catch (err) {
    next(err);
  }
});

// ---------- CREAR VENTA ----------
router.post('/', authenticate, async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user;
    const sellerUserId = user?.sub;

    if (!sellerUserId) {
      return res.status(401).json({ error: 'Missing or invalid token' });
    }

    console.log('[sales] POST /api/v1/sales by', sellerUserId);

    const parsed = createSaleSchema.parse(req.body);

    const sale = await createSaleService({
      sellerUserId,
      clientId: parsed.clientId,
      currency: parsed.currency,
      rateSource: parsed.rateSource,
      manualRate: parsed.manualRate,
      overrideNote: parsed.overrideNote,
      items: parsed.items,
      initialPayments: parsed.initialPayments || [],
    });

    res.status(201).json(sale);
  } catch (err) {
    console.error('sales.create error:', err);
    next(err);
  }
});

// ---------- AGREGAR PAGO/ABONO ----------
router.post('/:id/payments', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const parsed = addPaymentSchema.parse(req.body);
    const sale = await addPaymentTx({
      saleId: id,
      method: parsed.method,
      currency: parsed.currency,
      amount: parsed.amount,
      note: parsed.note,
      rateSource: parsed.rateSource,
      manualRate: parsed.manualRate,
    });
    res.status(201).json(sale);
  } catch (err) {
    next(err);
  }
});

// ---------- ANULAR VENTA ----------
router.post('/:id/void', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const sale = await voidSaleTx(id);
    res.json(sale);
  } catch (err) {
    next(err);
  }
});

export default router;
