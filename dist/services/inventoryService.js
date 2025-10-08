"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listInventory = listInventory;
exports.getMovementById = getMovementById;
exports.createAdjust = createAdjust;
exports.deleteAdjust = deleteAdjust;
const client_1 = require("@prisma/client");
const index_1 = require("../index");
const ALLOWED_SORT_FIELDS = ['date', 'id', 'productId', 'type', 'quantity', 'unitCostBs'];
function sanitizePagination(n, fallback) {
    const v = Number(n);
    if (!isFinite(v) || v <= 0)
        return fallback;
    return Math.floor(v);
}
function sanitizeSort(field, dir) {
    const f = ALLOWED_SORT_FIELDS.includes(field) ? field : 'date';
    const d = dir === 'asc' ? 'asc' : 'desc';
    return { field: f, dir: d };
}
async function listInventory(params) {
    const q = String(params.q || '').trim();
    const page = sanitizePagination(params.page, 1);
    const size = Math.min(sanitizePagination(params.size, 12), 100);
    const { field, dir } = sanitizeSort(params.sortField, params.sortDir);
    const where = {
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
    const orderBy = {
        [field]: dir,
    };
    const [rows, total] = await Promise.all([
        index_1.prisma.inventoryMovement.findMany({
            where,
            include: { product: { select: { id: true, name: true, code: true } } },
            orderBy,
            skip: (page - 1) * size,
            take: size,
        }),
        index_1.prisma.inventoryMovement.count({ where }),
    ]);
    return { rows, total, page, size };
}
async function getMovementById(id) {
    const row = await index_1.prisma.inventoryMovement.findUnique({
        where: { id },
        include: { product: { select: { id: true, name: true, code: true } } },
    });
    if (!row) {
        throw Object.assign(new Error('Movimiento no encontrado'), { status: 404 });
    }
    return row;
}
async function createAdjust(input) {
    const { productId, type, quantity, unitCostBs } = input;
    if (!productId || !quantity || quantity <= 0) {
        throw Object.assign(new Error('Datos inválidos'), { status: 400 });
    }
    return index_1.prisma.$transaction(async (tx) => {
        const mov = await tx.inventoryMovement.create({
            data: {
                productId,
                type,
                quantity: new client_1.Prisma.Decimal(quantity),
                unitCostBs: new client_1.Prisma.Decimal(unitCostBs || 0),
                referenceType: 'ADJUST',
                referenceId: 0,
            },
        });
        // actualizar stock
        await tx.product.update({
            where: { id: productId },
            data: type === 'IN'
                ? { stock: { increment: quantity } }
                : { stock: { decrement: quantity } },
        });
        return mov;
    });
}
async function deleteAdjust(id) {
    return index_1.prisma.$transaction(async (tx) => {
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
            data: mov.type === 'IN'
                ? { stock: { decrement: qty } }
                : { stock: { increment: qty } },
        });
        await tx.inventoryMovement.delete({ where: { id } });
        return { ok: true };
    });
}
