"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdjustSchema = exports.listInventoryQuerySchema = void 0;
const zod_1 = require("zod");
exports.listInventoryQuerySchema = zod_1.z.object({
    q: zod_1.z.string().optional(),
    type: zod_1.z.enum(['IN', 'OUT']).optional(),
    referenceType: zod_1.z.enum(['PURCHASE', 'SALE', 'ADJUST']).optional(), // <-- sin duplicado
    from: zod_1.z.string().optional(), // o z.coerce.date().optional()
    to: zod_1.z.string().optional(), // o z.coerce.date().optional()
    page: zod_1.z.coerce.number().int().positive().default(1),
    size: zod_1.z.coerce.number().int().positive().max(200).default(10),
    sort: zod_1.z.string().default('date:desc'),
    productId: zod_1.z.coerce.number().int().positive().optional(),
});
exports.createAdjustSchema = zod_1.z.object({
    productId: zod_1.z.coerce.number().int().positive(),
    type: zod_1.z.enum(['IN', 'OUT']),
    quantity: zod_1.z.coerce.number().positive(), // 3 decimales en DB
    unitCostBs: zod_1.z.coerce.number().nonnegative(), // costo unitario en Bs
    note: zod_1.z.string().max(300).optional(),
});
