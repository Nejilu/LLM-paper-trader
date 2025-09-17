"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const db_1 = require("@paper-trading/db");
const portfolio_1 = require("../src/portfolio");
(0, vitest_1.describe)("applyTrade", () => {
    (0, vitest_1.it)("computes a new average price for buy trades", () => {
        const position = mockPosition({ qty: 10, avgPrice: 100 });
        const result = (0, portfolio_1.applyTrade)(position, { symbol: "AAPL", side: "BUY", qty: 5, price: 110 });
        (0, vitest_1.expect)(result.qty.toNumber()).toBeCloseTo(15);
        (0, vitest_1.expect)(result.avgPrice.toNumber()).toBeCloseTo((10 * 100 + 5 * 110) / 15);
    });
    (0, vitest_1.it)("reduces quantity for sells and keeps avg price", () => {
        const position = mockPosition({ qty: 10, avgPrice: 120 });
        const result = (0, portfolio_1.applyTrade)(position, { symbol: "AAPL", side: "SELL", qty: 4, price: 130 });
        (0, vitest_1.expect)(result.qty.toNumber()).toBeCloseTo(6);
        (0, vitest_1.expect)(result.avgPrice.toNumber()).toBeCloseTo(120);
    });
    (0, vitest_1.it)("throws when selling more than available", () => {
        const position = mockPosition({ qty: 2, avgPrice: 50 });
        (0, vitest_1.expect)(() => (0, portfolio_1.applyTrade)(position, { symbol: "AAPL", side: "SELL", qty: 3, price: 60 })).toThrow("Cannot sell more shares than currently held");
    });
});
(0, vitest_1.describe)("computePositionDto", () => {
    (0, vitest_1.it)("computes market value and PnL statistics", () => {
        const position = mockPosition({ qty: 8, avgPrice: 95, symbol: "MSFT" });
        const dto = (0, portfolio_1.computePositionDto)(position, { price: 100, change: 2, changePercent: 2 });
        (0, vitest_1.expect)(dto.marketPrice).toBe(100);
        (0, vitest_1.expect)(dto.marketValue).toBeCloseTo(800);
        (0, vitest_1.expect)(dto.unrealizedPnL).toBeCloseTo(40);
        (0, vitest_1.expect)(dto.dailyPnL).toBeCloseTo(16);
    });
});
function mockPosition({ qty, avgPrice, symbol = "AAPL" }) {
    return {
        id: 1,
        portfolioId: 1,
        symbol,
        qty: new db_1.Prisma.Decimal(qty),
        avgPrice: new db_1.Prisma.Decimal(avgPrice)
    };
}
