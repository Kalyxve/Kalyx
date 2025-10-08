"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPurchaseTx = createPurchaseTx;
exports.addPurchasePaymentTx = addPurchasePaymentTx;
exports.getPurchaseById = getPurchaseById;
exports.listPurchases = listPurchases;
const index_1 = require("../index");
const client_1 = require("@prisma/client");
const rateProvider_1 = require("./rateProvider");
async function createPurchaseTx(params) {
    const { supplierId, currency, rateSource, manualRate, items } = params;
    if (!items?.length)
        throw new Error('Sin items');
    const rate = await (0, rateProvider_1.getRate)(rateSource, manualRate);
    return index_1.prisma.$transaction(async (tx) => {
        // totales
        let totalBs = 0;
        let totalUsd = 0;
        const createItems = [];
        for (const it of items) {
            const product = await tx.product.findUnique({
                where: { id: it.productId },
                select: { id: true, priceBs: true, priceUsd: true },
            });
            if (!product)
                throw new Error('Producto no encontrado');
            const qty = Number(it.quantity || 0);
            const unit = Number(it.unitCost || 0);
            if (!qty || !unit)
                continue;
            // costo en Bs por unidad
            const costBs = currency === 'BS' ? unit : Number((unit * rate).toFixed(2));
            const lineBs = Number((costBs * qty).toFixed(2));
            const lineUsd = currency === 'USD'
                ? Number((unit * qty).toFixed(2))
                : Number((lineBs / rate).toFixed(2));
            totalBs += lineBs;
            totalUsd += lineUsd;
            createItems.push({
                productId: product.id,
                quantity: new client_1.Prisma.Decimal(qty),
                unitCost: new client_1.Prisma.Decimal(unit),
                costBs: new client_1.Prisma.Decimal(costBs),
            });
        }
        totalBs = Number(totalBs.toFixed(2));
        totalUsd = Number(totalUsd.toFixed(2));
        // crea compra
        const purchase = await tx.purchase.create({
            data: {
                supplierId,
                currency,
                rate: new client_1.Prisma.Decimal(rate),
                totalBs: new client_1.Prisma.Decimal(totalBs),
                totalUsd: new client_1.Prisma.Decimal(totalUsd),
                paidBs: new client_1.Prisma.Decimal(0),
                paidUsd: new client_1.Prisma.Decimal(0),
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
            if (!qty)
                continue;
            const costBsUnit = currency === 'BS'
                ? Number(it.unitCost)
                : Number((Number(it.unitCost) * rate).toFixed(2));
            await tx.inventoryMovement.create({
                data: {
                    productId: it.productId,
                    type: 'IN',
                    quantity: new client_1.Prisma.Decimal(qty),
                    unitCostBs: new client_1.Prisma.Decimal(costBsUnit),
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
async function addPurchasePaymentTx(params) {
    const { purchaseId, method, currency, amount, note, rateSource, manualRate } = params;
    const purchase = await index_1.prisma.purchase.findUnique({
        where: { id: purchaseId },
    });
    if (!purchase)
        throw new Error('Compra no encontrada');
    // Toma la tasa solicitada (BCV o manual)
    const rate = await (0, rateProvider_1.getRate)(rateSource, manualRate);
    // Equivalencias
    const amountBs = currency === 'BS' ? amount : Number((amount * rate).toFixed(2));
    const amountUsd = currency === 'USD' ? amount : Number((amount / rate).toFixed(2));
    return index_1.prisma.$transaction(async (tx) => {
        await tx.purchasePayment.create({
            data: {
                purchaseId,
                method,
                currency,
                rate: new client_1.Prisma.Decimal(rate),
                amount: new client_1.Prisma.Decimal(amount),
                amountBs: new client_1.Prisma.Decimal(amountBs),
                amountUsd: new client_1.Prisma.Decimal(amountUsd),
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
async function getPurchaseById(id) {
    return index_1.prisma.purchase.findUnique({
        where: { id },
        include: {
            supplier: true,
            items: { include: { product: true } },
            payments: true,
        },
    });
}
async function listPurchases(opts) {
    const q = (opts.q || '').trim();
    const page = Math.max(1, Number(opts.page || 1));
    const size = Math.min(Math.max(1, Number(opts.size || 10)), 100);
    const [sortField = 'createdAt', sortDir = 'desc'] = String(opts.sort || 'createdAt:desc').split(':');
    const where = q
        ? {
            OR: [{ supplier: { name: { contains: q } } }],
        }
        : {};
    const [rows, total] = await Promise.all([
        index_1.prisma.purchase.findMany({
            where,
            include: {
                supplier: true,
                // para listado, no incluimos items para hacerlo más ligero
            },
            orderBy: { [sortField]: sortDir === 'asc' ? 'asc' : 'desc' },
            skip: (page - 1) * size,
            take: size,
        }),
        index_1.prisma.purchase.count({ where }),
    ]);
    return { rows, total, page, size };
}
