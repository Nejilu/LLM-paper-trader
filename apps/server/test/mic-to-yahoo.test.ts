import { describe, expect, it } from "vitest";
import { applyYahooSuffix, getYahooSuffixForMic, MIC_TO_SUFFIX } from "@paper-trading/server-shared";

describe("MIC to Yahoo mapping", () => {
  it("returns known suffixes", () => {
    expect(getYahooSuffixForMic("XPAR")).toBe(".PA");
    expect(getYahooSuffixForMic("XLON")).toBe(".L");
    expect(getYahooSuffixForMic("XASX")).toBe(".AX");
  });

  it("applies suffix to ticker", () => {
    expect(applyYahooSuffix("AAPL", "XNYS")).toBe("AAPL");
    expect(applyYahooSuffix("SHOP", "XTSE")).toBe("SHOP.TO");
    expect(applyYahooSuffix("AIR", "XPAR")).toBe("AIR.PA");
  });

  it("returns undefined for unknown venues", () => {
    expect(getYahooSuffixForMic("UNKN")).toBeUndefined();
    expect(applyYahooSuffix("ABC", "UNKN")).toBeUndefined();
  });

  it("contains mappings for major exchanges", () => {
    ["XPAR", "XLON", "XTSE", "XNAS", "XNYS", "XHKG", "XNSE", "BVMF", "XMEX"].forEach((mic) => {
      expect(MIC_TO_SUFFIX).toHaveProperty(mic);
    });
  });
});
