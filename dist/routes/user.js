"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const index_1 = require("../index");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const baseUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    role: zod_1.z.enum(['admin', 'seller']),
    active: zod_1.z.boolean().optional().default(true),
});
const createUserSchema = baseUserSchema.extend({
    password: zod_1.z.string().min(6, 'Min 6 caracteres'),
});
const updateUserSchema = baseUserSchema.extend({
    password: zod_1.z.string().min(6).optional(), // si viene, cambia hash
});
// GET /users?q=&page=&size=&sort=createdAt:desc
router.get('/', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const q = String(req.query.q || '').trim();
        const page = Number(req.query.page || 1);
        const size = Math.min(Number(req.query.size || 10), 100);
        const [sortField = 'createdAt', sortDir = 'desc'] = String(req.query.sort || 'createdAt:desc').split(':');
        const where = q
            ? {
                OR: [
                    { name: { contains: q } },
                    { email: { contains: q } },
                    { role: { equals: q } }, // opcional: buscar por 'admin' o 'seller'
                ],
            }
            : {};
        const [rows, total] = await Promise.all([
            index_1.prisma.user.findMany({
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
            index_1.prisma.user.count({ where }),
        ]);
        res.json({ rows, total, page, size });
    }
    catch (err) {
        next(err);
    }
});
// POST /users
router.post('/', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const data = createUserSchema.parse(req.body);
        const passwordHash = await bcryptjs_1.default.hash(data.password, 10);
        const user = await index_1.prisma.user.create({
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
    }
    catch (err) {
        next(err);
    }
});
// PUT /users/:id
router.put('/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const data = updateUserSchema.parse(req.body);
        let passwordHash;
        if (data.password) {
            passwordHash = await bcryptjs_1.default.hash(data.password, 10);
        }
        const user = await index_1.prisma.user.update({
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
    }
    catch (err) {
        next(err);
    }
});
// DELETE /users/:id  -> desactivar
router.delete('/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        await index_1.prisma.user.update({ where: { id }, data: { active: false } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
