"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rateProvider_1 = require("../services/rateProvider");
const router = (0, express_1.Router)();
// Endpoint GET /api/v1/rates/current?source=bcv|manual&value=xx
router.get('/current', async (req, res, next) => {
    try {
        const source = req.query.source || 'bcv';
        const manualValue = req.query.value ? Number(req.query.value) : undefined;
        const rate = await (0, rateProvider_1.getRate)(source, manualValue);
        res.json({ source, rate, updatedAt: new Date().toISOString() });
    }
    catch (err) {
        console.error('Error obteniendo tasa:', err.message);
        res.status(500).json({ error: err.message || 'Error interno' });
    }
});
exports.default = router;
