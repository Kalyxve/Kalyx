import type { Prisma, PrismaClient } from '@prisma/client';

type Tx = Prisma.TransactionClient | PrismaClient;

export async function nextProductCode(tx: Tx, categoryId: number) {
  const category = await tx.category.findUnique({
    where: { id: categoryId },
    select: { prefix: true },
  });
  if (!category) throw new Error('Categoría no encontrada');

  const prefix = category.prefix;

  const last = await tx.product.findFirst({
    where: { code: { startsWith: `${prefix}-` } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  const lastNum = last?.code?.split('-')[1] ?? '0000';
  const nextNum = String(parseInt(lastNum, 10) + 1).padStart(4, '0');

  return `${prefix}-${nextNum}`;
}

// NUEVO: correlativo para facturas INV-000001
export async function nextInvoiceNumber(tx: Tx) {
  const last = await tx.sale.findFirst({
    orderBy: { id: 'desc' }, // más seguro que parsear string
    select: { invoiceNumber: true },
  });

  let next = 1;
  if (last?.invoiceNumber) {
    const m = last.invoiceNumber.match(/(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `INV-${String(next).padStart(6, '0')}`;
}
