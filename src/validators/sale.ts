// src/validators/sale.ts
import { z } from 'zod';

export const saleItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.coerce.number().positive(), // permite "1" como string
  unitPrice: z.coerce.number().positive().optional(), // editable desde frontend (override)
  isFree: z.boolean().optional().default(false),
});

export const createSaleSchema = z.object({
  clientId: z.number().int().positive().optional(), // ventas sin cliente -> consumidor final
  currency: z.enum(['USD', 'BS']).default('BS'),
  rateSource: z.enum(['bcv', 'manual']).default('bcv'),
  manualRate: z.coerce.number().positive().optional(),
  overrideNote: z.string().max(300).optional(),
  items: z.array(saleItemSchema).min(1, 'Debe incluir al menos un producto'),

  // Pagos iniciales (opcional) para facturas con abono inmediato
  initialPayments: z
    .array(
      z.object({
        method: z.enum([
          'CASH_BS',
          'CASH_USD',
          'DEBIT_CARD',
          'PAGO_MOVIL',
          'TRANSFER_BS',
          'TRANSFER_USD',
        ]),
        currency: z.enum(['USD', 'BS']).default('BS'),
        amount: z.coerce.number().positive(),
        note: z.string().optional(),
      })
    )
    .optional(),
});

export const addPaymentSchema = z.object({
  method: z.enum([
    'CASH_BS',
    'CASH_USD',
    'DEBIT_CARD',
    'PAGO_MOVIL',
    'TRANSFER_BS',
    'TRANSFER_USD',
  ]),
  currency: z.enum(['USD', 'BS']).default('BS'),
  amount: z.coerce.number().positive(),
  note: z.string().optional(),
  rateSource: z.enum(['bcv', 'manual']).default('bcv'),
  manualRate: z.coerce.number().positive().optional(),
});
