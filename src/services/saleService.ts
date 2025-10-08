import { prisma } from '../index';
import { Prisma } from '@prisma/client';
import { getRate, RateSource } from './rateProvider';
import { toBsFromUsd } from '../utils/currency';

type CreateItem = {
  productId: number;
  quantity: number;
  unitPrice?: number; // en moneda de la venta
  isFree?: boolean;
};

type CreatePayment = {
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
};

export async function createSaleService(params: {
  sellerUserId: number; // 👈 VIENE DEL TOKEN
  clientId?: number;
  currency: 'USD' | 'BS';
  rateSource: RateSource;
  manualRate?: number;
  overrideNote?: string;
  items: CreateItem[];
  initialPayments?: CreatePayment[];
}) {
  const {
    sellerUserId,
    clientId,
    currency,
    rateSource,
    manualRate,
    overrideNote,
    items,
    initialPayments = [],
  } = params;

  if (!sellerUserId) {
    const err = new Error('No seller user id');
    (err as any).status = 401;
    throw err;
  }

  console.log('[sales] create by user:', sellerUserId);

  if (!items?.length) throw new Error('Sin items');

  const rate = await getRate(rateSource, manualRate);

  return prisma.$transaction(async (tx) => {
    // Correlativo de factura incremental
    const last = await tx.sale.findFirst({
      select: { invoiceNumber: true },
      orderBy: { id: 'desc' },
    });
    const lastNum = last?.invoiceNumber ?? '00000000';
    const nextNum = String(parseInt(lastNum, 10) + 1).padStart(8, '0');

    // Calcular totales
    let totalBs = 0;
    let totalUsd = 0;
    const lineItems: Prisma.SaleItemCreateManySaleInput[] = [];

    for (const it of items) {
      const product = await tx.product.findUnique({
        where: { id: it.productId },
        select: { id: true, priceUsd: true, priceBs: true },
      });
      if (!product) throw new Error('Producto no encontrado');

      const qty = Number(it.quantity || 0);
      if (!qty) continue;

      const unit =
        typeof it.unitPrice === 'number' && it.unitPrice > 0
          ? it.unitPrice
          : currency === 'USD'
            ? Number(product.priceUsd)
            : Number(product.priceBs);

      const priceBs =
        currency === 'BS' ? unit : Number((unit * rate).toFixed(2));

      const lineBs = it.isFree ? 0 : Number((priceBs * qty).toFixed(2));
      const lineUsd =
        currency === 'USD'
          ? it.isFree
            ? 0
            : Number((unit * qty).toFixed(2))
          : it.isFree
            ? 0
            : Number((lineBs / rate).toFixed(2));

      totalBs += lineBs;
      totalUsd += lineUsd;

      lineItems.push({
        productId: product.id,
        quantity: new Prisma.Decimal(qty),
        unitPrice: new Prisma.Decimal(unit),
        priceBs: new Prisma.Decimal(priceBs),
        isFree: !!it.isFree,
      });
    }

    totalBs = Number(totalBs.toFixed(2));
    totalUsd = Number(totalUsd.toFixed(2));

    // Crear venta principal
    const sale = await tx.sale.create({
      data: {
        clientId: clientId ?? null,
        sellerUserId,
        currency,
        rate: new Prisma.Decimal(rate),
        totalBs: new Prisma.Decimal(totalBs),
        totalUsd: new Prisma.Decimal(totalUsd),
        invoiceNumber: nextNum,
        overrideNote: overrideNote || null,
      },
    });

    // Crear ítems
    if (lineItems.length) {
      await tx.saleItem.createMany({
        data: lineItems.map((li) => ({ ...li, saleId: sale.id })),
      });
    }

    // Pagos iniciales
    let paidBs = 0;
    let paidUsd = 0;

    for (const p of initialPayments) {
      const amt = Number(p.amount || 0);
      if (!amt) continue;

      const amountBs =
        p.currency === 'BS' ? amt : Number((amt * rate).toFixed(2));
      const amountUsd =
        p.currency === 'USD' ? amt : Number((amt / rate).toFixed(2));

      await tx.salePayment.create({
        data: {
          saleId: sale.id,
          method: p.method,
          currency: p.currency,
          rate: new Prisma.Decimal(rate),
          amount: new Prisma.Decimal(amt),
          amountBs: new Prisma.Decimal(amountBs),
          amountUsd: new Prisma.Decimal(amountUsd),
          note: p.note || null,
        },
      });

      paidBs += amountBs;
      paidUsd += amountUsd;
    }

    paidBs = Number(paidBs.toFixed(2));
    paidUsd = Number(paidUsd.toFixed(2));

    // Actualizar status
    let status: 'OPEN' | 'PARTIAL' | 'PAID' = 'OPEN';
    if (paidBs > 0 || paidUsd > 0) status = 'PARTIAL';
    if (paidBs >= totalBs - 0.01 || paidUsd >= totalUsd - 0.01) status = 'PAID';

    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: {
        paidBs: new Prisma.Decimal(paidBs),
        paidUsd: new Prisma.Decimal(paidUsd),
        status,
      },
      include: { items: true, payments: true },
    });

    // Movimiento de inventario
    for (const it of items) {
      if (!it.productId || !it.quantity || it.isFree) continue;
      const qty = Number(it.quantity);
      await tx.inventoryMovement.create({
        data: {
          productId: it.productId,
          type: 'OUT',
          quantity: new Prisma.Decimal(qty),
          unitCostBs: new Prisma.Decimal(0),
          referenceType: 'SALE',
          referenceId: sale.id,
        },
      });
      await tx.product.update({
        where: { id: it.productId },
        data: { stock: { decrement: qty } },
      });
    }

    return updated;
  });
}

// ========== AGREGAR PAGO ==========
export async function addPaymentTx(data: {
  saleId: number;
  method: CreatePayment['method'];
  currency: 'USD' | 'BS';
  amount: number;
  note?: string;
  rateSource: RateSource;
  manualRate?: number;
}) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: data.saleId } });
    if (!sale) throw new Error('Venta no encontrada');

    const rate = await getRate(data.rateSource, data.manualRate);
    const amt = Number(data.amount);
    const amountBs =
      data.currency === 'BS' ? amt : Number((amt * rate).toFixed(2));
    const amountUsd =
      data.currency === 'USD' ? amt : Number((amt / rate).toFixed(2));

    await tx.salePayment.create({
      data: {
        saleId: sale.id,
        method: data.method,
        currency: data.currency,
        rate: new Prisma.Decimal(rate),
        amount: new Prisma.Decimal(amt),
        amountBs: new Prisma.Decimal(amountBs),
        amountUsd: new Prisma.Decimal(amountUsd),
        note: data.note || null,
      },
    });

    const newPaidBs = Number(sale.paidBs) + amountBs;
    const newPaidUsd = Number(sale.paidUsd) + amountUsd;

    let status: 'OPEN' | 'PARTIAL' | 'PAID' = 'PARTIAL';
    if (
      newPaidBs >= Number(sale.totalBs) - 0.01 ||
      newPaidUsd >= Number(sale.totalUsd) - 0.01
    )
      status = 'PAID';

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        paidBs: new Prisma.Decimal(newPaidBs),
        paidUsd: new Prisma.Decimal(newPaidUsd),
        status,
      },
    });

    return { saleId: sale.id, newPaidBs, newPaidUsd, status };
  });
}

// ========== ANULAR VENTA ==========
export async function voidSaleTx(saleId: number) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });
    if (!sale) throw new Error('Venta no encontrada');

    // Revertir inventario
    for (const item of sale.items) {
      if (!item.productId) continue;
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: Number(item.quantity) } },
      });
    }

    // Cambiar estado
    const updated = await tx.sale.update({
      where: { id: saleId },
      data: { status: 'VOID' },
    });

    return updated;
  });
}
