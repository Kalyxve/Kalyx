"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const zod_1 = require("zod");
const inventory_1 = require("../validators/inventory");
const inventoryService_1 = require("../services/inventoryService");
const router = (0, express_1.Router)();
/**
 * GET /api/v1/inventory
 * ?q=arroz&type=IN&page=1&size=20&sort=date:desc
 */
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const parsed = inventory_1.listInventoryQuerySchema.parse({
            ...req.query,
        });
        // sort viene como "campo:dir"
        const [sf = 'date', sd = 'desc'] = String(parsed.sort || 'date:desc').split(':');
        const out = await (0, inventoryService_1.listInventory)({
            q: parsed.q,
            type: parsed.type,
            page: parsed.page,
            size: parsed.size,
            sortField: sf,
            sortDir: sd === 'asc' ? 'asc' : 'desc',
            // from / to / productId / referenceType los puedes añadir luego al servicio
        });
        res.json(out);
    }
    catch (err) {
        console.error('inventory.list error:', err?.message, err?.stack);
        res
            .status(err?.status || 500)
            .json({ error: err?.message || 'Internal error' });
    }
});
/** GET /api/v1/inventory/:id */
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const id = zod_1.z.coerce.number().int().positive().parse(req.params.id);
        const out = await (0, inventoryService_1.getMovementById)(id);
        res.json(out);
    }
    catch (err) {
        console.error('inventory.get error:', err?.message);
        res
            .status(err?.status || 500)
            .json({ error: err?.message || 'Internal error' });
    }
});
/** POST /api/v1/inventory  (AJUSTE IN/OUT) */
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        const parsed = inventory_1.createAdjustSchema.parse(req.body);
        const out = await (0, inventoryService_1.createAdjust)(parsed);
        res.status(201).json(out);
    }
    catch (err) {
        console.error('inventory.createAdjust error:', err?.message);
        res
            .status(err?.status || 500)
            .json({ error: err?.message || 'Internal error' });
    }
});
/** DELETE /api/v1/inventory/:id  (Sólo AJUSTE) */
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const id = zod_1.z.coerce.number().int().positive().parse(req.params.id);
        const out = await (0, inventoryService_1.deleteAdjust)(id);
        res.json(out);
    }
    catch (err) {
        console.error('inventory.deleteAdjust error:', err?.message);
        res
            .status(err?.status || 500)
            .json({ error: err?.message || 'Internal error' });
    }
});
exports.default = router;
