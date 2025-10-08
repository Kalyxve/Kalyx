import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();

const clientSchema = z.object({
  name: z.string().min(2),
  rif: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  active: z.boolean().optional().default(true),
});

// GET /clients?q=&page=&size=&sort=createdAt:desc
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
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {};

    const [rows, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { [sortField]: sortDir === 'asc' ? 'asc' : 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      prisma.client.count({ where }),
    ]);

    res.json({ rows, total, page, size });
  } catch (err) {
    next(err);
  }
});

// POST /clients
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const data = clientSchema.parse(req.body);
    const client = await prisma.client.create({ data });
    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
});

// PUT /clients/:id
router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = clientSchema.parse(req.body);
    const client = await prisma.client.update({ where: { id }, data });
    res.json(client);
  } catch (err) {
    next(err);
  }
});

// DELETE /clients/:id  -> desactivar (borrado lógico)
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.client.update({ where: { id }, data: { active: false } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
