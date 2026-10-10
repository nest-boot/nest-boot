import type { IncomingMessage, ServerResponse } from "node:http";

const { mockHandler, mockToNodeHandler } = vi.hoisted(() => ({
  mockHandler: vi.fn().mockResolvedValue(undefined),
  mockToNodeHandler: vi.fn(),
}));

vi.mock("better-auth/node", () => ({
  toNodeHandler: mockToNodeHandler,
}));

import { AuthHandlerMiddleware } from "./auth-handler.middleware.js";

describe("AuthHandlerMiddleware", () => {
  beforeEach(() => {
    mockHandler.mockClear();
    mockToNodeHandler.mockReset().mockReturnValue(mockHandler);
  });

  it("creates its handler from the injected auth instance", () => {
    const auth = { handler: vi.fn() };

    new AuthHandlerMiddleware(auth);

    expect(mockToNodeHandler).toHaveBeenCalledOnce();
    expect(mockToNodeHandler).toHaveBeenCalledWith(auth);
  });

  it("delegates requests to the created handler", async () => {
    const middleware = new AuthHandlerMiddleware({ handler: vi.fn() });
    const request = {} as IncomingMessage;
    const response = {} as ServerResponse;

    await middleware.use(request, response);

    expect(mockHandler).toHaveBeenCalledOnce();
    expect(mockHandler).toHaveBeenCalledWith(request, response);
  });
});
