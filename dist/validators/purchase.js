"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addPurchasePaymentSchema = exports.createPurchaseSchema = void 0;
const zod_1 = require("zod");
exports.createPurchaseSchema = zod_1.z.object({
    supplierId: zod_1.z.number().int().positive(),
    currency: zod_1.z.enum(['USD', 'BS']),
    rateSource: zod_1.z.enum(['bcv', 'manual']).default('bcv'),
    manualRate: zod_1.z.number().positive().optional(),
    items: zod_1.z
        .array(zod_1.z.object({
        productId: zod_1.z.number().int().positive(),
        quantity: zod_1.z.number().positive(),
        unitCost: zod_1.z.number().positive(), // en moneda de la compra
    }))
        .min(1, 'Agrega al menos un producto'),
});
exports.addPurchasePaymentSchema = zod_1.z.object({
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
    note: zod_1.z.string().max(300).optional(),
    rateSource: zod_1.z.enum(['bcv', 'manual']).default('bcv'),
    manualRate: zod_1.z.number().positive().optional(),
});
