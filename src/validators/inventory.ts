import { z } from 'zod';

export const listInventoryQuerySchema = z.object({
  q: z.string().optional(),
  type: z.enum(['IN', 'OUT']).optional(),
  referenceType: z.enum(['PURCHASE', 'SALE', 'ADJUST']).optional(), // <-- sin duplicado
  from: z.string().optional(), // o z.coerce.date().optional()
  to: z.string().optional(), // o z.coerce.date().optional()
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(200).default(10),
  sort: z.string().default('date:desc'),
  productId: z.coerce.number().int().positive().optional(),
});
export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;

export const createAdjustSchema = z.object({
  productId: z.coerce.number().int().positive(),
  type: z.enum(['IN', 'OUT']),
  quantity: z.coerce.number().positive(), // 3 decimales en DB
  unitCostBs: z.coerce.number().nonnegative(), // costo unitario en Bs
  note: z.string().max(300).optional(),
});

export type CreateAdjustInput = z.infer<typeof createAdjustSchema>;
