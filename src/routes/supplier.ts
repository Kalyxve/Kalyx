import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();

const supplierSchema = z.object({
  name: z.string().min(2),
  rif: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
});

// GET /suppliers?q=&page=&size=&sort=createdAt:desc
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
            { name: { contains: q } },
            { rif: { contains: q } },
            { address: { contains: q } },
            { contact: { contains: q } },
          ],
        }
      : {};

    const [rows, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { [sortField]: sortDir === 'asc' ? 'asc' : 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.supplier.count({ where }),
    ]);

    res.json({ rows, total, page, size });
  } catch (err) {
    next(err);
  }
});

// POST /suppliers
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const data = supplierSchema.parse(req.body);
    const supplier = await prisma.supplier.create({ data });
    res.status(201).json(supplier);
  } catch (err) {
    next(err);
  }
});

// PUT /suppliers/:id
router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = supplierSchema.parse(req.body);
    const supplier = await prisma.supplier.update({ where: { id }, data });
    res.json(supplier);
  } catch (err) {
    next(err);
  }
});

// DELETE /suppliers/:id  -> desactivar
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.supplier.update({ where: { id }, data: { active: false } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
