"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addPaymentSchema = exports.createSaleSchema = exports.saleItemSchema = void 0;
// src/validators/sale.ts
const zod_1 = require("zod");
exports.saleItemSchema = zod_1.z.object({
    productId: zod_1.z.number().int().positive(),
    quantity: zod_1.z.coerce.number().positive(), // permite "1" como string
    unitPrice: zod_1.z.coerce.number().positive().optional(), // editable desde frontend (override)
    isFree: zod_1.z.boolean().optional().default(false),
});
exports.createSaleSchema = zod_1.z.object({
    clientId: zod_1.z.number().int().positive().optional(), // ventas sin cliente -> consumidor final
    currency: zod_1.z.enum(['USD', 'BS']).default('BS'),
    rateSource: zod_1.z.enum(['bcv', 'manual']).default('bcv'),
    manualRate: zod_1.z.coerce.number().positive().optional(),
    overrideNote: zod_1.z.string().max(300).optional(),
    items: zod_1.z.array(exports.saleItemSchema).min(1, 'Debe incluir al menos un producto'),
    // Pagos iniciales (opcional) para facturas con abono inmediato
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
        currency: zod_1.z.enum(['USD', 'BS']).default('BS'),
        amount: zod_1.z.coerce.number().positive(),
        note: zod_1.z.string().optional(),
    }))
        .optional(),
});
exports.addPaymentSchema = zod_1.z.object({
    method: zod_1.z.enum([
        'CASH_BS',
        'CASH_USD',
        'DEBIT_CARD',
        'PAGO_MOVIL',
        'TRANSFER_BS',
        'TRANSFER_USD',
    ]),
    currency: zod_1.z.enum(['USD', 'BS']).default('BS'),
    amount: zod_1.z.coerce.number().positive(),
    note: zod_1.z.string().optional(),
    rateSource: zod_1.z.enum(['bcv', 'manual']).default('bcv'),
    manualRate: zod_1.z.coerce.number().positive().optional(),
});
