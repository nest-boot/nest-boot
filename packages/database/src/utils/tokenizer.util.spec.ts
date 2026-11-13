import { tokenizer } from "./tokenizer.util.js";

describe("tokenizer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [
      "你好，世界！ Hello, Café 123 Привет 🎉",
      ["你好", "世界", "hello", "café", "123", "привет"],
    ],
    ["こんにちは、世界！", ["こんにちは", "世界"]],
    [" !!! 🎉 ", []],
  ])("splits multilingual words: %s", (input, expected) => {
    expect(tokenizer(input)).toEqual(expected);
  });

  it.each([undefined, {}])(
    "uses Unicode words without Intl.Segmenter: %j",
    async (intl) => {
      vi.stubGlobal("Intl", intl);
      vi.resetModules();
      const { tokenizer: fallback } = await import("./tokenizer.util.js");
      expect(fallback("你好，世界！ Cafe\u0301 123 Привет 🎉")).toEqual([
        "你好",
        "世界",
        "cafe\u0301",
        "123",
        "привет",
      ]);
      expect(fallback("!!! 🎉")).toEqual([]);
    },
  );
});
