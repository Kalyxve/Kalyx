"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Schema for create/update
const categorySchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    prefix: zod_1.z.string().min(2).max(3),
    active: zod_1.z.boolean().optional().default(true),
});
// GET /categories
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const categories = await index_1.prisma.category.findMany();
        res.json(categories);
    }
    catch (err) {
        next(err);
    }
});
// POST /categories
router.post('/', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const parsed = categorySchema.parse(req.body);
        const category = await index_1.prisma.category.create({ data: parsed });
        res.status(201).json(category);
    }
    catch (err) {
        next(err);
    }
});
// GET /categories/:id
router.get('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const category = await index_1.prisma.category.findUnique({ where: { id } });
        if (!category)
            return res.status(404).json({ error: 'Category not found' });
        res.json(category);
    }
    catch (err) {
        next(err);
    }
});
// PUT /categories/:id
router.put('/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const parsed = categorySchema.parse(req.body);
        const category = await index_1.prisma.category.update({ where: { id }, data: parsed });
        res.json(category);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /categories/:id (set inactive)
router.delete('/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        await index_1.prisma.category.update({ where: { id }, data: { active: false } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
