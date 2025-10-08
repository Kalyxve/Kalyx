"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const zod_1 = require("zod");
const saleService_1 = require("../services/saleService");
const index_1 = require("../index");
// ====== VALIDADORES (Zod) ======
const createSaleSchema = zod_1.z.object({
    clientId: zod_1.z.number().optional(),
    currency: zod_1.z.enum(['USD', 'BS']),
    rateSource: zod_1.z.enum(['bcv', 'manual']),
    manualRate: zod_1.z.number().optional(),
    overrideNote: zod_1.z.string().optional(),
    items: zod_1.z
        .array(zod_1.z.object({
        productId: zod_1.z.number(),
        quantity: zod_1.z.number().positive(),
        unitPrice: zod_1.z.number().optional(),
        isFree: zod_1.z.boolean().optional(),
    }))
        .min(1, 'Debe agregar al menos un producto.'),
    initialPayments: zod_1.z
        .array(zod_1.z.object({
        method: zod_1.z.enum([
            'CASH_BS',
            'CASH_USD',
            'DEBIT_CARD',
            'PAGO_MOVIL',
            'TRANSFER_BS',
            'TRANSFER_USD',
        ]),
        currency: zod_1.z.enum(['USD', 'BS']),
        amount: zod_1.z.number().positive(),
        note: zod_1.z.string().optional(),
    }))
        .optional(),
});
const addPaymentSchema = zod_1.z.object({
    method: zod_1.z.enum([
        'CASH_BS',
        'CASH_USD',
        'DEBIT_CARD',
        'PAGO_MOVIL',
        'TRANSFER_BS',
        'TRANSFER_USD',
    ]),
    currency: zod_1.z.enum(['USD', 'BS']),
    amount: zod_1.z.number().positive(),
    note: zod_1.z.string().optional(),
    rateSource: zod_1.z.enum(['bcv', 'manual']),
    manualRate: zod_1.z.number().optional(),
});
// ====== ROUTER ======
const router = (0, express_1.Router)();
// ---------- LISTAR VENTAS ----------
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const q = String(req.query.q || '').trim();
        const page = Number(req.query.page || 1);
        const size = Math.min(Number(req.query.size || 10), 100);
        const [sortField = 'createdAt', sortDir = 'desc'] = String(req.query.sort || 'createdAt:desc').split(':');
        const where = q
            ? {
                OR: [
                    { invoiceNumber: { contains: q } },
                    { client: { name: { contains: q } } },
                ],
            }
            : {};
        const [rows, total] = await Promise.all([
            index_1.prisma.sale.findMany({
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
            index_1.prisma.sale.count({ where }),
        ]);
        res.json({ rows, total, page, size });
    }
    catch (err) {
        next(err);
    }
});
// ---------- CREAR VENTA ----------
router.post('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = req.user;
        const sellerUserId = user?.sub;
        if (!sellerUserId) {
            return res.status(401).json({ error: 'Missing or invalid token' });
        }
        console.log('[sales] POST /api/v1/sales by', sellerUserId);
        const parsed = createSaleSchema.parse(req.body);
        const sale = await (0, saleService_1.createSaleService)({
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
    }
    catch (err) {
        console.error('sales.create error:', err);
        next(err);
    }
});
// ---------- AGREGAR PAGO/ABONO ----------
router.post('/:id/payments', auth_1.authenticate, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const parsed = addPaymentSchema.parse(req.body);
        const sale = await (0, saleService_1.addPaymentTx)({
            saleId: id,
            method: parsed.method,
            currency: parsed.currency,
            amount: parsed.amount,
            note: parsed.note,
            rateSource: parsed.rateSource,
            manualRate: parsed.manualRate,
        });
        res.status(201).json(sale);
    }
    catch (err) {
        next(err);
    }
});
// ---------- ANULAR VENTA ----------
router.post('/:id/void', auth_1.authenticate, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const sale = await (0, saleService_1.voidSaleTx)(id);
        res.json(sale);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
