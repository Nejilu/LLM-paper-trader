"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const server_shared_1 = require("@paper-trading/server-shared");
(0, vitest_1.describe)("MIC to Yahoo mapping", () => {
    (0, vitest_1.it)("returns known suffixes", () => {
        (0, vitest_1.expect)((0, server_shared_1.getYahooSuffixForMic)("XPAR")).toBe(".PA");
        (0, vitest_1.expect)((0, server_shared_1.getYahooSuffixForMic)("XLON")).toBe(".L");
        (0, vitest_1.expect)((0, server_shared_1.getYahooSuffixForMic)("XASX")).toBe(".AX");
    });
    (0, vitest_1.it)("applies suffix to ticker", () => {
        (0, vitest_1.expect)((0, server_shared_1.applyYahooSuffix)("AAPL", "XNYS")).toBe("AAPL");
        (0, vitest_1.expect)((0, server_shared_1.applyYahooSuffix)("SHOP", "XTSE")).toBe("SHOP.TO");
        (0, vitest_1.expect)((0, server_shared_1.applyYahooSuffix)("AIR", "XPAR")).toBe("AIR.PA");
    });
    (0, vitest_1.it)("returns undefined for unknown venues", () => {
        (0, vitest_1.expect)((0, server_shared_1.getYahooSuffixForMic)("UNKN")).toBeUndefined();
        (0, vitest_1.expect)((0, server_shared_1.applyYahooSuffix)("ABC", "UNKN")).toBeUndefined();
    });
    (0, vitest_1.it)("contains mappings for major exchanges", () => {
        ["XPAR", "XLON", "XTSE", "XNAS", "XNYS", "XHKG", "XNSE", "BVMF", "XMEX"].forEach((mic) => {
            (0, vitest_1.expect)(server_shared_1.MIC_TO_SUFFIX).toHaveProperty(mic);
        });
    });
});
