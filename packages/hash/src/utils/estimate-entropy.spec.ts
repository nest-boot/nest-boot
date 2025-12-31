import { estimateEntropy } from "./estimate-entropy";

describe("estimateEntropy", () => {
  it("should return 0 for empty string", () => {
    expect(estimateEntropy("")).toBe(0);
  });

  it("should return positive entropy for non-empty string", () => {
    expect(estimateEntropy("abc")).toBeGreaterThan(0);
  });

  it("should return higher entropy for more unique characters", () => {
    const lowEntropy = estimateEntropy("aaa");
    const highEntropy = estimateEntropy("abc");
    expect(highEntropy).toBeGreaterThan(lowEntropy);
  });
});
