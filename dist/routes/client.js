"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const clientSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    rif: zod_1.z.string().optional().nullable(),
    address: zod_1.z.string().optional().nullable(),
    phone: zod_1.z.string().optional().nullable(),
    email: zod_1.z.string().email().optional().nullable(),
    active: zod_1.z.boolean().optional().default(true),
});
// GET /clients?q=&page=&size=&sort=createdAt:desc
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
                    { email: { contains: q } },
                    { phone: { contains: q } },
                ],
            }
            : {};
        const [rows, total] = await Promise.all([
            index_1.prisma.client.findMany({
                where,
                orderBy: { [sortField]: sortDir === 'asc' ? 'asc' : 'desc' },
                skip: (page - 1) * size,
                take: size,
            }),
            index_1.prisma.client.count({ where }),
        ]);
        res.json({ rows, total, page, size });
    }
    catch (err) {
        next(err);
    }
});
// POST /clients
router.post('/', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const data = clientSchema.parse(req.body);
        const client = await index_1.prisma.client.create({ data });
        res.status(201).json(client);
    }
    catch (err) {
        next(err);
    }
});
// PUT /clients/:id
router.put('/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const data = clientSchema.parse(req.body);
        const client = await index_1.prisma.client.update({ where: { id }, data });
        res.json(client);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /clients/:id  -> desactivar (borrado lógico)
router.delete('/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        await index_1.prisma.client.update({ where: { id }, data: { active: false } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
