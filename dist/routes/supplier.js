"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const supplierSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    rif: zod_1.z.string().optional().nullable(),
    address: zod_1.z.string().optional().nullable(),
    contact: zod_1.z.string().optional().nullable(),
    active: zod_1.z.boolean().optional().default(true),
});
// GET /suppliers?q=&page=&size=&sort=createdAt:desc
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const q = String(req.query.q || '').trim();
        const page = Number(req.query.page || 1);
        const size = Math.min(Number(req.query.size || 10), 100);
        const [sortField = 'createdAt', sortDir = 'desc'] = String(req.query.sort || 'createdAt:desc').split(':');
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
            index_1.prisma.supplier.findMany({
                where,
                orderBy: { [sortField]: sortDir === 'asc' ? 'asc' : 'desc' },
                skip: (page - 1) * size,
                take: size,
            }),
            index_1.prisma.supplier.count({ where }),
        ]);
        res.json({ rows, total, page, size });
    }
    catch (err) {
        next(err);
    }
});
// POST /suppliers
router.post('/', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const data = supplierSchema.parse(req.body);
        const supplier = await index_1.prisma.supplier.create({ data });
        res.status(201).json(supplier);
    }
    catch (err) {
        next(err);
    }
});
// PUT /suppliers/:id
router.put('/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const data = supplierSchema.parse(req.body);
        const supplier = await index_1.prisma.supplier.update({ where: { id }, data });
        res.json(supplier);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /suppliers/:id  -> desactivar
router.delete('/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        await index_1.prisma.supplier.update({ where: { id }, data: { active: false } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
