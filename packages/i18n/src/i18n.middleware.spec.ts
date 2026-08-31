const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  setRequestContextValue: vi.fn(),
}));

vi.mock("@nest-boot/request-context", () => ({
  RequestContext: {
    set: mocks.setRequestContextValue,
  },
}));

vi.mock("i18next", () => ({
  default: { name: "shared-i18next" },
}));

vi.mock("i18next-http-middleware", () => ({
  handle: mocks.handle,
}));

import type { Request, Response } from "express";
import i18next from "i18next";

import { I18N } from "./i18n.constants.js";
import { I18nMiddleware } from "./i18n.middleware.js";

describe("I18nMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the detected request instance before continuing", () => {
    const requestI18n = { language: "de" };
    const request = { i18n: requestI18n } as unknown as Request;
    const response = {} as Response;
    const next = vi.fn();
    const options = {
      detection: { order: ["header"] },
      fallbackLng: "en",
    };
    mocks.handle.mockReturnValue(
      (_request: Request, _response: Response, handlerNext: () => void) => {
        handlerNext();
      },
    );

    const middleware = new I18nMiddleware(options);
    middleware.use(request, response, next);

    expect(mocks.handle).toHaveBeenCalledWith(i18next, options);
    expect(mocks.setRequestContextValue).toHaveBeenCalledWith(
      I18N,
      requestI18n,
    );
    expect(next).toHaveBeenCalledOnce();
  });
});
