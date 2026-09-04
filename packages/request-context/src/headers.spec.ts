import type { Request } from "express";

import { headers } from "./headers.js";
import { REQUEST } from "./request-context.constants.js";
import { RequestContext } from "./request-context.js";

describe("headers", () => {
  it("returns fetch-compatible headers from the current HTTP request", async () => {
    const request = {
      headers: {
        authorization: "Bearer token",
        cookie: "session=value",
        "x-forwarded-for": ["127.0.0.1", "127.0.0.2"],
      },
    } as unknown as Request;

    await RequestContext.run(
      new RequestContext({ type: "http" }),
      (context) => {
        context.set(REQUEST, request);

        const result = headers();

        expect(result.get("authorization")).toBe("Bearer token");
        expect(result.get("cookie")).toBe("session=value");
        expect(result.get("x-forwarded-for")).toBe("127.0.0.1, 127.0.0.2");
      },
    );
  });

  it("fails outside an HTTP request context", () => {
    expect(() => headers()).toThrow(
      "headers() is only available within an HTTP request context",
    );
  });

  it("fails when a non-HTTP context has no request", async () => {
    await RequestContext.run(new RequestContext({ type: "job" }), () => {
      expect(() => headers()).toThrow(
        "headers() is only available within an HTTP request context",
      );
    });
  });
});
