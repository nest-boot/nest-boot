import { headers } from "./headers.js";
import { REQUEST } from "./request-context.constants.js";
import { RequestContext } from "./request-context.js";

describe("headers", () => {
  it("returns a Fetch-compatible snapshot of request headers", async () => {
    const request = {
      headers: {
        authorization: "Bearer token",
        cookie: "session=value",
        "x-forwarded-for": ["127.0.0.1", "127.0.0.2"],
      },
    };

    await RequestContext.run(
      new RequestContext({ type: "http" }),
      (context) => {
        context.set(REQUEST, request);

        const result = headers();
        result.set("authorization", "changed");

        expect(result.get("authorization")).toBe("changed");
        expect(request.headers.authorization).toBe("Bearer token");
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

  it("fails when an HTTP context has no request", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      expect(() => headers()).toThrow(
        "headers() is only available within an HTTP request context",
      );
    });
  });

  it("fails when a non-HTTP context contains a request token", async () => {
    await RequestContext.run(new RequestContext({ type: "job" }), (context) => {
      context.set(REQUEST, { headers: {} });

      expect(() => headers()).toThrow(
        "headers() is only available within an HTTP request context",
      );
    });
  });
});
