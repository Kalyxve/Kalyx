import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, requireAdmin } from '../middlewares/auth';
import { getRate, RateSource } from '../services/rateProvider';
import { toBsFromUsd, toUsdFromBs } from '../utils/currency';
import { nextProductCode } from '../utils/correlative';

const router = Router();

const createSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().min(2),
  unit: z.enum(['UNIT', 'KG']),
  inputCurrency: z.enum(['USD', 'BS']),
  costInput: z.number().positive(),
  rateSource: z.enum(['bcv', 'manual']),
  manualRate: z.number().positive().optional(),
  marginPct: z.number().min(0).max(100).default(30),
  priceBs: z.number().positive().optional(),
  minStock: z.number().min(0).default(0),
  active: z.boolean().optional().default(true),
});

const updateSchema = createSchema.partial().extend({
  id: z.number().int().positive(),
});

function computePrices(params: {
  inputCurrency: 'USD' | 'BS';
  costInput: number;
  rate: number;
  marginPct: number;
  priceBs?: number;
}) {
  const { inputCurrency, costInput, rate, marginPct, priceBs } = params;

  const costBs =
    inputCurrency === 'USD'
      ? toBsFromUsd(costInput, rate)
      : +costInput.toFixed(2);

  const suggestedBs = +(costBs * (1 + marginPct / 100)).toFixed(2);

  const finalPriceBs =
    typeof priceBs === 'number' && priceBs > 0
      ? +priceBs.toFixed(2)
      : suggestedBs;

  const finalPriceUsd = toUsdFromBs(finalPriceBs, rate);

  return { costBs, priceBs: finalPriceBs, priceUsd: finalPriceUsd };
}

// Listado
router.get('/', authenticate, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const page = Number(req.query.page || 1);
    const size = Math.min(Number(req.query.size || 10), 100);
    const [sortField = 'createdAt', sortDir = 'desc'] = String(
      req.query.sort || 'createdAt:desc'
    ).split(':');

    const where = q
      ? { OR: [{ name: { contains: q } }, { code: { contains: q } }] }
      : {};

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { [sortField]: sortDir === 'asc' ? 'asc' : 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ rows, total, page, size });
  } catch (err) {
    next(err);
  }
});

// Crear
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const payload = createSchema.parse(req.body);

    const rate = await getRate(
      payload.rateSource as RateSource,
      payload.manualRate
    );
    const { costBs, priceBs, priceUsd } = computePrices({
      inputCurrency: payload.inputCurrency,
      costInput: payload.costInput,
      rate,
      marginPct: payload.marginPct ?? 30,
      priceBs: payload.priceBs,
    });

    const data = await prisma.$transaction(async (tx) => {
      let code = await nextProductCode(tx, payload.categoryId);

      for (let i = 0; i < 5; i++) {
        try {
          const created = await tx.product.create({
            data: {
              categoryId: payload.categoryId,
              code,
              name: payload.name,
              unit: payload.unit,
              costBs,
              priceBs,
              priceUsd,
              stock: 0,
              minStock: payload.minStock,
              active: payload.active ?? true,
            },
            include: { category: true },
          });
          return created;
        } catch (e: any) {
          if (String(e?.code) === 'P2002') {
            code = await nextProductCode(tx, payload.categoryId);
            continue;
          }
          throw e;
        }
      }
      throw new Error('No se pudo generar código único de producto');
    });

    res.status(201).json({ ...data, rateUsed: rate });
  } catch (err) {
    next(err);
  }
});

// Obtener uno
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product)
      return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// Actualizar
router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = updateSchema.parse({ ...req.body, id });

    let rate: number | undefined;

    // Obtén fuente de tasa por prioridad (payload → env → 'bcv')
    const src: RateSource =
      (payload.rateSource as RateSource) ??
      ((process.env.RATE_SOURCE as RateSource) || 'bcv');

    // Si se toca algo que afecte precios o priceBs directo, trae tasa
    if (
      payload.rateSource !== undefined ||
      payload.manualRate !== undefined ||
      payload.inputCurrency !== undefined ||
      payload.costInput !== undefined ||
      payload.priceBs !== undefined
    ) {
      rate = await getRate(src, payload.manualRate);
    }

    let computed: { costBs?: number; priceBs?: number; priceUsd?: number } = {};

    if (rate && payload.costInput !== undefined && payload.inputCurrency) {
      computed = computePrices({
        inputCurrency: payload.inputCurrency,
        costInput: payload.costInput!,
        rate,
        marginPct: payload.marginPct ?? 30,
        priceBs: payload.priceBs,
      });
    } else if (rate && typeof payload.priceBs === 'number') {
      computed = {
        priceBs: payload.priceBs,
        priceUsd: toUsdFromBs(payload.priceBs, rate),
      };
    }

    let newCode: string | undefined;
    if (payload.categoryId) {
      newCode = await nextProductCode(prisma, payload.categoryId);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(payload.categoryId
          ? { categoryId: payload.categoryId, code: newCode }
          : {}),
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.unit ? { unit: payload.unit } : {}),
        ...(typeof computed.costBs === 'number'
          ? { costBs: computed.costBs }
          : {}),
        ...(typeof computed.priceBs === 'number'
          ? { priceBs: computed.priceBs }
          : {}),
        ...(typeof computed.priceUsd === 'number'
          ? { priceUsd: computed.priceUsd }
          : {}),
        ...(typeof payload.minStock === 'number'
          ? { minStock: payload.minStock }
          : {}),
        ...(typeof payload.active === 'boolean'
          ? { active: payload.active }
          : {}),
      },
      include: { category: true },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Desactivar
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.product.update({ where: { id }, data: { active: false } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
