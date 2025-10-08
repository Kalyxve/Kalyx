"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRate = getRate;
const index_1 = require("../index");
const DEFAULT_CACHE_MINUTES = 30;
/**
 * Intenta obtener de cache (ExchangeRateLog) antes de ir a la red.
 */
async function getCachedRate(maxMinutes = DEFAULT_CACHE_MINUTES) {
    const since = new Date(Date.now() - maxMinutes * 60 * 1000);
    return index_1.prisma.exchangeRateLog.findFirst({
        where: { timestamp: { gte: since } },
        orderBy: { timestamp: 'desc' },
    });
}
async function fetchBcvRate() {
    const url = process.env.BCV_API_URL ?? 'https://bcv-api.rafnixg.dev/rates/';
    try {
        const resp = await fetch(url, { headers: { accept: 'application/json' } });
        if (!resp.ok)
            throw new Error(`BCV API error: ${resp.status}`);
        const data = await resp.json();
        // 👇 esta API devuelve "dollar": 185.3983
        const rate = Number(data?.dollar);
        if (!rate || isNaN(rate)) {
            throw new Error('No se pudo parsear la tasa desde rafnixg API.');
        }
        // ✅ guarda en base de datos
        await index_1.prisma.exchangeRateLog.create({
            data: { source: 'bcv', value: rate },
        });
        return rate;
    }
    catch (err) {
        console.error('⚠️ Error al conectar con BCV:', err.message);
        // fallback cacheado, si existe
        const cached = await getCachedRate();
        if (cached)
            return Number(cached.value);
        throw new Error('No se pudo conectar con el BCV ni obtener cache.');
    }
}
async function getRate(source, manualValue) {
    if (source === 'manual') {
        if (!manualValue || manualValue <= 0)
            throw new Error('Tasa manual inválida');
        await index_1.prisma.exchangeRateLog.create({
            data: { source: 'manual', value: manualValue },
        });
        return manualValue;
    }
    // source === 'bcv'
    const cached = await getCachedRate();
    if (cached && cached.source === 'bcv')
        return Number(cached.value);
    const value = await fetchBcvRate();
    await index_1.prisma.exchangeRateLog.create({ data: { source: 'bcv', value } });
    return value;
}
