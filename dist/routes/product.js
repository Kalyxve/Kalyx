"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const index_1 = require("../index");
const auth_1 = require("../middlewares/auth");
const rateProvider_1 = require("../services/rateProvider");
const currency_1 = require("../utils/currency");
const correlative_1 = require("../utils/correlative");
const router = (0, express_1.Router)();
const createSchema = zod_1.z.object({
    categoryId: zod_1.z.number().int().positive(),
    name: zod_1.z.string().min(2),
    unit: zod_1.z.enum(['UNIT', 'KG']),
    inputCurrency: zod_1.z.enum(['USD', 'BS']),
    costInput: zod_1.z.number().positive(),
    rateSource: zod_1.z.enum(['bcv', 'manual']),
    manualRate: zod_1.z.number().positive().optional(),
    marginPct: zod_1.z.number().min(0).max(100).default(30),
    priceBs: zod_1.z.number().positive().optional(),
    minStock: zod_1.z.number().min(0).default(0),
    active: zod_1.z.boolean().optional().default(true),
});
const updateSchema = createSchema.partial().extend({
    id: zod_1.z.number().int().positive(),
});
function computePrices(params) {
    const { inputCurrency, costInput, rate, marginPct, priceBs } = params;
    const costBs = inputCurrency === 'USD'
        ? (0, currency_1.toBsFromUsd)(costInput, rate)
        : +costInput.toFixed(2);
    const suggestedBs = +(costBs * (1 + marginPct / 100)).toFixed(2);
    const finalPriceBs = typeof priceBs === 'number' && priceBs > 0
        ? +priceBs.toFixed(2)
        : suggestedBs;
    const finalPriceUsd = (0, currency_1.toUsdFromBs)(finalPriceBs, rate);
    return { costBs, priceBs: finalPriceBs, priceUsd: finalPriceUsd };
}
// Listado
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const q = String(req.query.q || '').trim();
        const page = Number(req.query.page || 1);
        const size = Math.min(Number(req.query.size || 10), 100);
        const [sortField = 'createdAt', sortDir = 'desc'] = String(req.query.sort || 'createdAt:desc').split(':');
        const where = q
            ? { OR: [{ name: { contains: q } }, { code: { contains: q } }] }
            : {};
        const [rows, total] = await Promise.all([
            index_1.prisma.product.findMany({
                where,
                include: { category: true },
                orderBy: { [sortField]: sortDir === 'asc' ? 'asc' : 'desc' },
                skip: (page - 1) * size,
                take: size,
            }),
            index_1.prisma.product.count({ where }),
        ]);
        res.json({ rows, total, page, size });
    }
    catch (err) {
        next(err);
    }
});
// Crear
router.post('/', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const payload = createSchema.parse(req.body);
        const rate = await (0, rateProvider_1.getRate)(payload.rateSource, payload.manualRate);
        const { costBs, priceBs, priceUsd } = computePrices({
            inputCurrency: payload.inputCurrency,
            costInput: payload.costInput,
            rate,
            marginPct: payload.marginPct ?? 30,
            priceBs: payload.priceBs,
        });
        const data = await index_1.prisma.$transaction(async (tx) => {
            let code = await (0, correlative_1.nextProductCode)(tx, payload.categoryId);
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
                }
                catch (e) {
                    if (String(e?.code) === 'P2002') {
                        code = await (0, correlative_1.nextProductCode)(tx, payload.categoryId);
                        continue;
                    }
                    throw e;
                }
            }
            throw new Error('No se pudo generar código único de producto');
        });
        res.status(201).json({ ...data, rateUsed: rate });
    }
    catch (err) {
        next(err);
    }
});
// Obtener uno
router.get('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const product = await index_1.prisma.product.findUnique({
            where: { id },
            include: { category: true },
        });
        if (!product)
            return res.status(404).json({ error: 'Producto no encontrado' });
        res.json(product);
    }
    catch (err) {
        next(err);
    }
});
// Actualizar
router.put('/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const payload = updateSchema.parse({ ...req.body, id });
        let rate;
        // Obtén fuente de tasa por prioridad (payload → env → 'bcv')
        const src = payload.rateSource ??
            (process.env.RATE_SOURCE || 'bcv');
        // Si se toca algo que afecte precios o priceBs directo, trae tasa
        if (payload.rateSource !== undefined ||
            payload.manualRate !== undefined ||
            payload.inputCurrency !== undefined ||
            payload.costInput !== undefined ||
            payload.priceBs !== undefined) {
            rate = await (0, rateProvider_1.getRate)(src, payload.manualRate);
        }
        let computed = {};
        if (rate && payload.costInput !== undefined && payload.inputCurrency) {
            computed = computePrices({
                inputCurrency: payload.inputCurrency,
                costInput: payload.costInput,
                rate,
                marginPct: payload.marginPct ?? 30,
                priceBs: payload.priceBs,
            });
        }
        else if (rate && typeof payload.priceBs === 'number') {
            computed = {
                priceBs: payload.priceBs,
                priceUsd: (0, currency_1.toUsdFromBs)(payload.priceBs, rate),
            };
        }
        let newCode;
        if (payload.categoryId) {
            newCode = await (0, correlative_1.nextProductCode)(index_1.prisma, payload.categoryId);
        }
        const updated = await index_1.prisma.product.update({
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
    }
    catch (err) {
        next(err);
    }
});
// Desactivar
router.delete('/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        await index_1.prisma.product.update({ where: { id }, data: { active: false } });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
