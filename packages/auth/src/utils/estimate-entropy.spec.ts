import { estimateEntropy } from "./estimate-entropy.js";

describe("estimateEntropy", () => {
  it("should return zero for empty strings", () => {
    expect(estimateEntropy("")).toBe(0);
  });

  it("should estimate entropy from unique characters and length", () => {
    expect(estimateEntropy("aaaa")).toBe(0);
    expect(estimateEntropy("abcd")).toBe(8);
  });
});
