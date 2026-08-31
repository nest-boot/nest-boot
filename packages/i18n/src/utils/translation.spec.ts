const mocks = vi.hoisted(() => ({
  fallbackTranslate: vi.fn(),
  getRequestContextValue: vi.fn(),
}));

vi.mock("@nest-boot/request-context", () => ({
  RequestContext: {
    get: mocks.getRequestContextValue,
  },
}));

vi.mock("i18next", () => ({
  default: {
    t: mocks.fallbackTranslate,
  },
}));

import { t, translation } from "./translation.js";

describe("translation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the request-scoped i18n instance", () => {
    const requestTranslate = vi.fn(() => "Hallo");
    mocks.getRequestContextValue.mockReturnValue({ t: requestTranslate });

    expect(translation("greeting", { lng: "de" })).toBe("Hallo");
    expect(requestTranslate).toHaveBeenCalledWith("greeting", { lng: "de" });
    expect(mocks.fallbackTranslate).not.toHaveBeenCalled();
  });

  it("falls back to the shared i18next instance", () => {
    mocks.getRequestContextValue.mockReturnValue(undefined);
    mocks.fallbackTranslate.mockReturnValue("Hello");

    expect(translation(["missing", "greeting"])).toBe("Hello");
    expect(mocks.fallbackTranslate).toHaveBeenCalledWith([
      "missing",
      "greeting",
    ]);
  });

  it("exports t as an alias", () => {
    expect(t).toBe(translation);
  });
});
