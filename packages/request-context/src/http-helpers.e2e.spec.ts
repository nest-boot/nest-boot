import type { Server } from "node:http";

import express from "express";

import { cookies } from "./cookies.js";
import { headers } from "./headers.js";
import { RequestContextMiddleware } from "./request-context.middleware.js";

describe("HTTP request helpers", () => {
  it("reads request data and appends separate cookies through Express", async () => {
    const app = express();
    const middleware = new RequestContextMiddleware();

    app.use((request, response, next) => {
      void middleware.use(request, response, next).catch(next);
    });
    app.get("/", (_request, response) => {
      const store = cookies();

      store.set("first", "one", { httpOnly: true, path: "/" });
      store.set("second", "two", { sameSite: "lax" });
      response.json({
        client: headers().get("x-client"),
        session: store.get("session")?.value,
      });
    });

    const server = await listen(app);

    try {
      const address = server.address();

      if (!address || typeof address === "string") {
        throw new Error("Expected Express to listen on a TCP port");
      }

      const response = await fetch(`http://127.0.0.1:${String(address.port)}`, {
        headers: {
          cookie: "session=express",
          "x-client": "integration-test",
        },
      });

      expect(await response.json()).toEqual({
        client: "integration-test",
        session: "express",
      });
      expect(response.headers.getSetCookie()).toEqual([
        "first=one; Path=/; HttpOnly",
        "second=two; Path=/; SameSite=Lax",
      ]);
    } finally {
      await close(server);
    }
  });
});

function listen(app: ReturnType<typeof express>): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      resolve(server);
    });
    server.on("error", reject);
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
