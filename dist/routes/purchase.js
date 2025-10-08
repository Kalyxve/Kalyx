"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const purchase_1 = require("../validators/purchase");
const purchaseService_1 = require("../services/purchaseService");
const router = (0, express_1.Router)();
// Listado con búsqueda/paginación
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const q = String(req.query.q || '');
        const page = Number(req.query.page || 1);
        const size = Number(req.query.size || 10);
        const sort = String(req.query.sort || 'createdAt:desc');
        const out = await (0, purchaseService_1.listPurchases)({ q, page, size, sort });
        res.json(out);
    }
    catch (err) {
        next(err);
    }
});
// Detalle
router.get('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const purchase = await (0, purchaseService_1.getPurchaseById)(id);
        if (!purchase)
            return res.status(404).json({ error: 'No encontrada' });
        res.json(purchase);
    }
    catch (err) {
        next(err);
    }
});
// Crear compra
router.post('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const parsed = purchase_1.createPurchaseSchema.parse(req.body);
        const created = await (0, purchaseService_1.createPurchaseTx)({
            supplierId: parsed.supplierId,
            currency: parsed.currency,
            rateSource: parsed.rateSource,
            manualRate: parsed.manualRate,
            items: parsed.items,
        });
        res.status(201).json(created);
    }
    catch (err) {
        next(err);
    }
});
// Abonar / registrar pago
router.post('/:id/payments', auth_1.authenticate, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const parsed = purchase_1.addPurchasePaymentSchema.parse(req.body);
        const updated = await (0, purchaseService_1.addPurchasePaymentTx)({
            purchaseId: id,
            method: parsed.method,
            currency: parsed.currency,
            amount: parsed.amount,
            note: parsed.note,
            rateSource: parsed.rateSource,
            manualRate: parsed.manualRate,
        });
        res.status(201).json(updated);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
