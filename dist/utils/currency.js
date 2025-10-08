"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toUsdFromBs = exports.toBsFromUsd = void 0;
const toBsFromUsd = (usd, rate) => +(usd * rate).toFixed(2);
exports.toBsFromUsd = toBsFromUsd;
const toUsdFromBs = (bs, rate) => +(bs / rate).toFixed(2);
exports.toUsdFromBs = toUsdFromBs;
