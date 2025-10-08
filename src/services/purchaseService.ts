import { prisma } from '../index';
import { Prisma } from '@prisma/client';
import { getRate, RateSource } from './rateProvider';

type CreateItem = {
  productId: number;
  quantity: number;
  unitCost: number; // en moneda de la compra
};

export async function createPurchaseTx(params: {
  supplierId: number;
  currency: 'USD' | 'BS';
  rateSource: RateSource;
  manualRate?: number;
  items: CreateItem[];
}) {
  const { supplierId, currency, rateSource, manualRate, items } = params;
  if (!items?.length) throw new Error('Sin items');

  const rate = await getRate(rateSource, manualRate);

  return prisma.$transaction(async (tx) => {
    // totales
    let totalBs = 0;
    let totalUsd = 0;

    const createItems: Prisma.PurchaseItemCreateManyPurchaseInput[] = [];

    for (const it of items) {
      const product = await tx.product.findUnique({
        where: { id: it.productId },
        select: { id: true, priceBs: true, priceUsd: true },
      });
      if (!product) throw new Error('Producto no encontrado');

      const qty = Number(it.quantity || 0);
      const unit = Number(it.unitCost || 0);
      if (!qty || !unit) continue;

      // costo en Bs por unidad
      const costBs =
        currency === 'BS' ? unit : Number((unit * rate).toFixed(2));

      const lineBs = Number((costBs * qty).toFixed(2));
      const lineUsd =
        currency === 'USD'
          ? Number((unit * qty).toFixed(2))
          : Number((lineBs / rate).toFixed(2));

      totalBs += lineBs;
      totalUsd += lineUsd;

      createItems.push({
        productId: product.id,
        quantity: new Prisma.Decimal(qty),
        unitCost: new Prisma.Decimal(unit),
        costBs: new Prisma.Decimal(costBs),
      });
    }

    totalBs = Number(totalBs.toFixed(2));
    totalUsd = Number(totalUsd.toFixed(2));

    // crea compra
    const purchase = await tx.purchase.create({
      data: {
        supplierId,
        currency,
        rate: new Prisma.Decimal(rate),
        totalBs: new Prisma.Decimal(totalBs),
        totalUsd: new Prisma.Decimal(totalUsd),
        paidBs: new Prisma.Decimal(0),
        paidUsd: new Prisma.Decimal(0),
      },
    });

    // ítems
    if (createItems.length) {
      await tx.purchaseItem.createMany({
        data: createItems.map((ci) => ({ ...ci, purchaseId: purchase.id })),
      });
    }

    // movimientos de inventario (entradas) + update stock
    for (const it of items) {
      const qty = Number(it.quantity || 0);
      if (!qty) continue;

      const costBsUnit =
        currency === 'BS'
          ? Number(it.unitCost)
          : Number((Number(it.unitCost) * rate).toFixed(2));

      await tx.inventoryMovement.create({
        data: {
          productId: it.productId,
          type: 'IN',
          quantity: new Prisma.Decimal(qty),
          unitCostBs: new Prisma.Decimal(costBsUnit),
          referenceType: 'PURCHASE',
          referenceId: purchase.id,
        },
      });

      await tx.product.update({
        where: { id: it.productId },
        data: {
          stock: { increment: qty },
          // opcional: actualizar costo/price sugerido basado en compra
          // costBs: new Prisma.Decimal(costBsUnit)  // si manejas costo promedio, ajústalo
        },
      });
    }

    return tx.purchase.findUnique({
      where: { id: purchase.id },
      include: {
        supplier: true,
        items: { include: { product: true } },
        payments: true,
      },
    });
  });
}

export async function addPurchasePaymentTx(params: {
  purchaseId: number;
  method:
    | 'CASH_BS'
    | 'CASH_USD'
    | 'DEBIT_CARD'
    | 'PAGO_MOVIL'
    | 'TRANSFER_BS'
    | 'TRANSFER_USD';
  currency: 'USD' | 'BS';
  amount: number;
  note?: string;
  rateSource: RateSource;
  manualRate?: number;
}) {
  const { purchaseId, method, currency, amount, note, rateSource, manualRate } =
    params;

  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
  });
  if (!purchase) throw new Error('Compra no encontrada');

  // Toma la tasa solicitada (BCV o manual)
  const rate = await getRate(rateSource, manualRate);

  // Equivalencias
  const amountBs =
    currency === 'BS' ? amount : Number((amount * rate).toFixed(2));
  const amountUsd =
    currency === 'USD' ? amount : Number((amount / rate).toFixed(2));

  return prisma.$transaction(async (tx) => {
    await tx.purchasePayment.create({
      data: {
        purchaseId,
        method,
        currency,
        rate: new Prisma.Decimal(rate),
        amount: new Prisma.Decimal(amount),
        amountBs: new Prisma.Decimal(amountBs),
        amountUsd: new Prisma.Decimal(amountUsd),
        note: note || null,
      },
    });

    const updated = await tx.purchase.update({
      where: { id: purchaseId },
      data: {
        paidBs: { increment: amountBs },
        paidUsd: { increment: amountUsd },
      },
      include: {
        supplier: true,
        items: { include: { product: true } },
        payments: true,
      },
    });

    return updated;
  });
}

export async function getPurchaseById(id: number) {
  return prisma.purchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { include: { product: true } },
      payments: true,
    },
  });
}

export async function listPurchases(opts: {
  q?: string;
  page?: number;
  size?: number;
  sort?: string; // ej: "createdAt:desc"
}) {
  const q = (opts.q || '').trim();
  const page = Math.max(1, Number(opts.page || 1));
  const size = Math.min(Math.max(1, Number(opts.size || 10)), 100);
  const [sortField = 'createdAt', sortDir = 'desc'] = String(
    opts.sort || 'createdAt:desc'
  ).split(':');

  const where = q
    ? {
        OR: [{ supplier: { name: { contains: q } } }],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: {
        supplier: true,
        // para listado, no incluimos items para hacerlo más ligero
      },
      orderBy: { [sortField]: sortDir === 'asc' ? 'asc' : 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.purchase.count({ where }),
  ]);

  return { rows, total, page, size };
}
