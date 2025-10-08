import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();

// Schema for create/update
const categorySchema = z.object({
  name: z.string().min(2),
  prefix: z.string().min(2).max(3),
  active: z.boolean().optional().default(true),
});

// GET /categories
router.get('/', authenticate, async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany();
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// POST /categories
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const parsed = categorySchema.parse(req.body);
    const category = await prisma.category.create({ data: parsed });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

// GET /categories/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (err) {
    next(err);
  }
});

// PUT /categories/:id
router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const parsed = categorySchema.parse(req.body);
    const category = await prisma.category.update({ where: { id }, data: parsed });
    res.json(category);
  } catch (err) {
    next(err);
  }
});

// DELETE /categories/:id (set inactive)
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.category.update({ where: { id }, data: { active: false } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;