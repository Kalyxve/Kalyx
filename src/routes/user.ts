import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../index';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();

const baseUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['admin', 'seller']),
  active: z.boolean().optional().default(true),
});

const createUserSchema = baseUserSchema.extend({
  password: z.string().min(6, 'Min 6 caracteres'),
});

const updateUserSchema = baseUserSchema.extend({
  password: z.string().min(6).optional(), // si viene, cambia hash
});

// GET /users?q=&page=&size=&sort=createdAt:desc
router.get('/', authenticate, requireAdmin, async (req, res, next) => {
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
            { email: { contains: q } },
            { role: { equals: q as any } }, // opcional: buscar por 'admin' o 'seller'
          ],
        }
      : {};

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { [sortField]: sortDir === 'asc' ? 'asc' : 'desc' },
        skip: (page - 1) * size,
        take: size,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ rows, total, page, size });
  } catch (err) {
    next(err);
  }
});

// POST /users
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        role: data.role,
        active: data.active ?? true,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// PUT /users/:id
router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = updateUserSchema.parse(req.body);
    let passwordHash: string | undefined;

    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        role: data.role,
        active: data.active ?? true,
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// DELETE /users/:id  -> desactivar
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.user.update({ where: { id }, data: { active: false } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
