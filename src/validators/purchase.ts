import { z } from 'zod';

export const createPurchaseSchema = z.object({
  supplierId: z.number().int().positive(),
  currency: z.enum(['USD', 'BS']),
  rateSource: z.enum(['bcv', 'manual']).default('bcv'),
  manualRate: z.number().positive().optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().positive(),
        unitCost: z.number().positive(), // en moneda de la compra
      })
    )
    .min(1, 'Agrega al menos un producto'),
});

export const addPurchasePaymentSchema = z.object({
  method: z.enum([
    'CASH_BS',
    'CASH_USD',
    'DEBIT_CARD',
    'PAGO_MOVIL',
    'TRANSFER_BS',
    'TRANSFER_USD',
  ]),
  currency: z.enum(['USD', 'BS']),
  amount: z.number().positive(),
  note: z.string().max(300).optional(),
  rateSource: z.enum(['bcv', 'manual']).default('bcv'),
  manualRate: z.number().positive().optional(),
});
