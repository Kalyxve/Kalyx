export const toBsFromUsd = (usd: number, rate: number) =>
  +(usd * rate).toFixed(2);
export const toUsdFromBs = (bs: number, rate: number) =>
  +(bs / rate).toFixed(2);
