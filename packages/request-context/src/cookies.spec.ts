import { cookies } from "./cookies.js";
import { REQUEST, RESPONSE } from "./request-context.constants.js";
import { RequestContext } from "./request-context.js";

describe("cookies", () => {
  it("reads zero incoming cookies", async () => {
    await runWithHttpContext({ headers: {} }, undefined, () => {
      const store = cookies();

      expect(store.get("missing")).toBeUndefined();
      expect(store.getAll()).toEqual([]);
      expect(store.has("missing")).toBe(false);
      expect(store.toString()).toBe("");
    });
  });

  it("reads and decodes incoming cookies", async () => {
    await runWithHttpContext(
      {
        headers: {
          cookie: "session=abc123; theme=dark%20mode",
        },
      },
      undefined,
      () => {
        const store = cookies();

        expect(store.get("session")).toEqual({
          name: "session",
          value: "abc123",
        });
        expect(store.get("theme")).toEqual({
          name: "theme",
          value: "dark mode",
        });
        expect(store.getAll()).toEqual([
          { name: "session", value: "abc123" },
          { name: "theme", value: "dark mode" },
        ]);
        expect(store.getAll("theme")).toEqual([
          { name: "theme", value: "dark mode" },
        ]);
        expect(store.has("session")).toBe(true);
        expect(store.toString()).toBe("session=abc123; theme=dark%20mode");
      },
    );
  });

  it("preserves duplicate incoming cookie names in request order", async () => {
    await runWithHttpContext(
      {
        headers: {
          cookie: "theme=light; session=value; theme=dark",
        },
      },
      undefined,
      () => {
        const store = cookies();

        expect(store.get("theme")).toEqual({ name: "theme", value: "light" });
        expect(store.getAll("theme")).toEqual([
          { name: "theme", value: "light" },
          { name: "theme", value: "dark" },
        ]);
        expect(store.toString()).toBe("theme=light; session=value; theme=dark");
      },
    );
  });

  it("ignores malformed incoming cookies that cannot be serialized", async () => {
    await runWithHttpContext(
      {
        headers: {
          cookie: "valid=one; bad name=value; another=two",
        },
      },
      undefined,
      () => {
        const store = cookies();

        expect(store.get("bad name")).toBeUndefined();
        expect(store.getAll()).toEqual([
          { name: "valid", value: "one" },
          { name: "another", value: "two" },
        ]);
        expect(store.toString()).toBe("valid=one; another=two");
      },
    );
  });

  it("takes a snapshot of incoming cookies", async () => {
    const request = { headers: { cookie: "session=initial" } };

    await runWithHttpContext(request, undefined, () => {
      const store = cookies();
      request.headers.cookie = "session=changed";

      expect(store.get("session")?.value).toBe("initial");
    });
  });

  it("serializes structured cookie options", async () => {
    const response = createResponse();

    await runWithHttpContext({ headers: {} }, response, () => {
      cookies().set("session", "token value", {
        httpOnly: true,
        path: "/",
        priority: "high",
        sameSite: "lax",
        secure: true,
      });
    });

    expect(response.headers["set-cookie"]).toEqual([
      "session=token%20value; Path=/; HttpOnly; Secure; Priority=High; SameSite=Lax",
    ]);
  });

  it("supports Next.js-style object arguments and chainable writes", async () => {
    const response = createResponse();

    await runWithHttpContext({ headers: {} }, response, () => {
      const store = cookies();

      expect(
        store.set({
          httpOnly: true,
          name: "session",
          value: "token",
        }),
      ).toBe(store);
      expect(
        store.delete({
          name: "legacy",
          path: "/account",
        }),
      ).toBe(store);
    });

    expect(response.headers["set-cookie"]).toEqual([
      "session=token; Path=/; HttpOnly",
      "legacy=; Path=/account; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ]);
  });

  it("keeps multiple outgoing Set-Cookie values separate", async () => {
    const response = createResponse({
      "set-cookie": "existing=value; Path=/",
    });

    await runWithHttpContext({ headers: {} }, response, () => {
      const store = cookies();
      store.set("first", "one");
      store.set("second", "two");
    });

    expect(response.headers["set-cookie"]).toEqual([
      "existing=value; Path=/",
      "first=one; Path=/",
      "second=two; Path=/",
    ]);
  });

  it("uses native header appending when the response supports it", async () => {
    const values: string[] = [];
    const response = {
      appendHeader(name: string, value: string) {
        expect(name).toBe("Set-Cookie");
        values.push(value);
      },
      headersSent: false,
    };

    await runWithHttpContext({ headers: {} }, response, () => {
      const store = cookies();
      store.set("first", "one");
      store.set("second", "two");
    });

    expect(values).toEqual(["first=one; Path=/", "second=two; Path=/"]);
  });

  it("deletes a cookie from the root path by default", async () => {
    const response = createResponse();

    await runWithHttpContext({ headers: {} }, response, () => {
      cookies().delete("session");
    });

    expect(response.headers["set-cookie"]).toEqual([
      "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ]);
  });

  it("allows deletion attributes to identify the original cookie", async () => {
    const response = createResponse();

    await runWithHttpContext({ headers: {} }, response, () => {
      cookies().delete({
        domain: "example.com",
        name: "session",
        path: "/account",
        sameSite: "strict",
        secure: true,
      });
    });

    expect(response.headers["set-cookie"]).toEqual([
      "session=; Domain=example.com; Path=/account; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Strict",
    ]);
  });

  it("fails outside an HTTP request context", () => {
    expect(() => cookies()).toThrow(
      "cookies() is only available within an HTTP request context",
    );
  });

  it("fails when a non-HTTP context contains a request token", async () => {
    await RequestContext.run(new RequestContext({ type: "job" }), (context) => {
      context.set(REQUEST, { headers: {} });

      expect(() => cookies()).toThrow(
        "cookies() is only available within an HTTP request context",
      );
    });
  });

  it("fails to write without a response context", async () => {
    await runWithHttpContext({ headers: {} }, undefined, () => {
      expect(() => {
        cookies().set("session", "value");
      }).toThrow("Cookie writes require a writable HTTP response context");
    });
  });

  it("fails when a retained store writes outside its request context", async () => {
    let store: ReturnType<typeof cookies> | undefined;

    await runWithHttpContext({ headers: {} }, createResponse(), () => {
      store = cookies();
    });

    expect(() => store?.set("session", "value")).toThrow(
      "Cookie writes require a writable HTTP response context",
    );
  });

  it("fails when the response cannot append or set headers", async () => {
    await runWithHttpContext({ headers: {} }, { headersSent: false }, () => {
      expect(() => {
        cookies().set("session", "value");
      }).toThrow("Cookie writes require a writable HTTP response context");
    });
  });

  it("fails to write after response headers have been sent", async () => {
    const response = createResponse();
    response.headersSent = true;

    await runWithHttpContext({ headers: {} }, response, () => {
      expect(() => {
        cookies().set("session", "value");
      }).toThrow(
        "Cookie writes are not allowed after response headers have been sent",
      );
    });
  });
});

interface TestRequest {
  headers: Record<string, string | string[] | undefined>;
}

interface TestResponse {
  headers: Record<string, string | string[]>;
  headersSent: boolean;
  getHeader(name: string): string | string[] | undefined;
  setHeader(name: string, value: string | string[]): void;
}

function createResponse(
  headers: Record<string, string | string[]> = {},
): TestResponse {
  return {
    headers,
    headersSent: false,
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
  };
}

async function runWithHttpContext(
  request: TestRequest,
  response: unknown,
  callback: () => void,
): Promise<void> {
  await RequestContext.run(new RequestContext({ type: "http" }), (context) => {
    context.set(REQUEST, request);
    if (response !== undefined) context.set(RESPONSE, response);
    callback();
  });
}
