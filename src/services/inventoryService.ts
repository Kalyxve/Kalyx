import { Prisma } from '@prisma/client';
import { prisma } from '../index';

export type ListParams = {
  q?: string;
  type?: 'IN' | 'OUT';
  page?: number;
  size?: number;
  sortField?: keyof Prisma.InventoryMovementOrderByWithRelationInput | 'date';
  sortDir?: 'asc' | 'desc';
};

const ALLOWED_SORT_FIELDS: Array<
  keyof Prisma.InventoryMovementOrderByWithRelationInput
> = ['date', 'id', 'productId', 'type', 'quantity', 'unitCostBs'];

function sanitizePagination(n: any, fallback: number) {
  const v = Number(n);
  if (!isFinite(v) || v <= 0) return fallback;
  return Math.floor(v);
}

function sanitizeSort(
  field: any,
  dir: any
): {
  field: keyof Prisma.InventoryMovementOrderByWithRelationInput;
  dir: 'asc' | 'desc';
} {
  const f = ALLOWED_SORT_FIELDS.includes(field) ? field : 'date';
  const d = dir === 'asc' ? 'asc' : 'desc';
  return { field: f, dir: d };
}

export async function listInventory(params: ListParams) {
  const q = String(params.q || '').trim();
  const page = sanitizePagination(params.page, 1);
  const size = Math.min(sanitizePagination(params.size, 12), 100);
  const { field, dir } = sanitizeSort(params.sortField, params.sortDir);

  const where: Prisma.InventoryMovementWhereInput = {
    ...(params.type ? { type: params.type } : {}),
    ...(q
      ? {
          OR: [
            { product: { name: { contains: q } } },
            { product: { code: { contains: q } } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.InventoryMovementOrderByWithRelationInput = {
    [field]: dir,
  } as any;

  const [rows, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      include: { product: { select: { id: true, name: true, code: true } } },
      orderBy,
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  return { rows, total, page, size };
}

export async function getMovementById(id: number) {
  const row = await prisma.inventoryMovement.findUnique({
    where: { id },
    include: { product: { select: { id: true, name: true, code: true } } },
  });
  if (!row) {
    throw Object.assign(new Error('Movimiento no encontrado'), { status: 404 });
  }
  return row;
}

export async function createAdjust(input: {
  productId: number;
  type: 'IN' | 'OUT';
  quantity: number;
  unitCostBs: number;
  note?: string;
}) {
  const { productId, type, quantity, unitCostBs } = input;
  if (!productId || !quantity || quantity <= 0) {
    throw Object.assign(new Error('Datos inválidos'), { status: 400 });
  }

  return prisma.$transaction(async (tx) => {
    const mov = await tx.inventoryMovement.create({
      data: {
        productId,
        type,
        quantity: new Prisma.Decimal(quantity),
        unitCostBs: new Prisma.Decimal(unitCostBs || 0),
        referenceType: 'ADJUST',
        referenceId: 0,
      },
    });

    // actualizar stock
    await tx.product.update({
      where: { id: productId },
      data:
        type === 'IN'
          ? { stock: { increment: quantity } }
          : { stock: { decrement: quantity } },
    });

    return mov;
  });
}

export async function deleteAdjust(id: number) {
  return prisma.$transaction(async (tx) => {
    const mov = await tx.inventoryMovement.findUnique({ where: { id } });
    if (!mov) {
      throw Object.assign(new Error('Movimiento no encontrado'), {
        status: 404,
      });
    }
    if (mov.referenceType !== 'ADJUST') {
      throw Object.assign(new Error('Solo se pueden eliminar ajustes'), {
        status: 400,
      });
    }

    const qty = Number(mov.quantity);
    await tx.product.update({
      where: { id: mov.productId },
      data:
        mov.type === 'IN'
          ? { stock: { decrement: qty } }
          : { stock: { increment: qty } },
    });

    await tx.inventoryMovement.delete({ where: { id } });
    return { ok: true };
  });
}
