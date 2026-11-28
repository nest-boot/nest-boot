import { createServer, type RequestListener, type Server } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { type Readable } from "node:stream";
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";

import { BadRequestException } from "@nestjs/common";

import {
  compileSsrfPolicy,
  fetchExternalFile,
  isPrivateOrReservedIp,
} from "./fetch-external-file.util.js";

describe("fetchExternalFile", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => {
              resolve();
            });
          }),
      ),
    );
  });

  it("identifies private, loopback, link-local, local NAT64, and mapped IPv4/IPv6 addresses", () => {
    for (const disallowed of [
      "0.0.0.0",
      "10.0.0.1",
      "100.64.0.1",
      "127.0.0.1",
      "168.63.129.16",
      "169.254.169.254",
      "172.16.0.1",
      "192.0.0.1",
      "192.0.2.1",
      "192.88.99.1",
      "192.168.1.1",
      "198.18.0.1",
      "198.51.100.1",
      "203.0.113.1",
      "224.0.0.1",
      "::",
      "::1",
      "::127.0.0.1",
      "::ffff:127.0.0.1",
      "::ffff:168.63.129.16",
      "100::1",
      "64:ff9b::10.0.0.1",
      "64:ff9b::168.63.129.16",
      "64:ff9b:1::93.184.216.34",
      "fc00::1",
      "fe80::1%eth0",
      "fec0::1",
      "ff02::1",
      "2001::1",
      "2001:2::1",
      "2001:db8::1",
      "2002:7f00:1::1",
      "2002:a83f:8110::1",
      "not-an-ip",
    ]) {
      expect(isPrivateOrReservedIp(disallowed)).toBe(true);
    }

    for (const allowed of [
      "93.184.216.34",
      "168.63.129.17",
      "::ffff:93.184.216.34",
      "64:ff9b::93.184.216.34",
      "2002:5db8:d822::1",
      "2606:2800:220:1:248:1893:25c8:1946",
    ]) {
      expect(isPrivateOrReservedIp(allowed)).toBe(false);
    }
  });

  it("validates ssrf options and enforces deadlines and cancellation during DNS lookup", async () => {
    expect(() => compileSsrfPolicy({ allowedHosts: ["   "] })).toThrow(
      "Storage SSRF allowedHosts entries must be non-empty host or IP patterns",
    );
    expect(() =>
      compileSsrfPolicy({ allowedHosts: ["https://corp.internal/files"] }),
    ).toThrow(
      "Storage SSRF allowedHosts entries must be non-empty host or IP patterns",
    );
    expect(() =>
      compileSsrfPolicy({ allowedHosts: [123 as unknown as string] }),
    ).toThrow(
      "Storage SSRF allowedHosts entries must be non-empty host or IP patterns",
    );
    expect(() =>
      compileSsrfPolicy({ allowedHosts: ["!secret.corp.internal"] }),
    ).toThrow("Storage SSRF allowedHosts entries must not use negation");

    const policy = compileSsrfPolicy({
      allowedHosts: ["*.Corp.Internal", "[::1]"],
    });
    expect(policy.enabled).toBe(true);
    expect(policy.isAllowedHost("media.corp.internal")).toBe(true);
    expect(policy.isAllowedHost("::1")).toBe(true);
    expect(policy.isAllowedHost("corp.internal")).toBe(false);

    await expect(fetchExternalFile("not a url")).rejects.toThrow(
      BadRequestException,
    );
    await expect(fetchExternalFile("ftp://example.com/a.png")).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      fetchExternalFile("https://user:pass@example.com/a.png"),
    ).rejects.toThrow(BadRequestException);
    await expect(
      fetchExternalFile("https://example.com/a.png", { maxFileSize: 0 }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      fetchExternalFile("https://example.com/a.png", { timeout: 0 }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      fetchExternalFile("http://127.0.0.1/secret.txt"),
    ).rejects.toThrow("disallowed network address");
    await expect(fetchExternalFile("http://[::1]/secret.txt")).rejects.toThrow(
      "disallowed network address",
    );
    await expect(
      fetchExternalFile("https://internal.example.com/a.png", {
        lookupFn: () =>
          Promise.resolve([{ address: "169.254.169.254", family: 4 }]),
      }),
    ).rejects.toThrow("disallowed network address");
    await expect(
      fetchExternalFile("https://empty.example.com/a.png", {
        lookupFn: () => Promise.resolve([]),
        ssrf: { enabled: false },
      }),
    ).rejects.toThrow("disallowed network address");
    await expect(
      fetchExternalFile("https://unresolvable.example.com/a.png", {
        lookupFn: () => Promise.reject(new Error("ENOTFOUND")),
      }),
    ).rejects.toThrow("Unable to resolve external file hostname");

    // Hanging DNS lookup respects fetch timeout
    await expect(
      fetchExternalFile("https://stalled-dns.example.com/a.png", {
        lookupFn: () => new Promise<never>(() => undefined),
        timeout: 25,
      }),
    ).rejects.toThrow("External file request timed out");

    // Hanging DNS lookup respects caller abort signal
    const dnsAbort = new AbortController();
    setTimeout(() => {
      dnsAbort.abort();
    }, 15);
    await expect(
      fetchExternalFile("https://aborted-dns.example.com/a.png", {
        lookupFn: () => new Promise<never>(() => undefined),
        signal: dnsAbort.signal,
      }),
    ).rejects.toThrow("Failed to fetch external file URL");
  });

  it("streams valid responses, isolates redirects, rejects 206/101/bad Location without URL leaks, and enforces size/abort/timeout limits", async () => {
    const port = await startServer(servers, (req, res) => {
      if (req.url === "/redirect") {
        res.writeHead(302, { location: "/files/avatar.png" });
        res.end();
        return;
      }
      if (req.url === "/redirect-metadata") {
        res.writeHead(302, {
          location: "http://169.254.169.254/latest/meta-data/",
        });
        res.end();
        return;
      }
      if (req.url?.startsWith("/bad-location")) {
        res.writeHead(302, { location: "http://[::1" });
        res.end();
        return;
      }
      if (req.url === "/partial") {
        res.writeHead(206, { "content-range": "bytes 0-3/100" });
        res.end("part");
        return;
      }
      if (req.url === "/no-location") {
        res.writeHead(302);
        res.end();
        return;
      }
      if (req.url === "/loop") {
        res.writeHead(302, { location: "/loop" });
        res.end();
        return;
      }
      if (req.url === "/missing") {
        res.writeHead(404);
        res.end("missing");
        return;
      }
      if (req.url === "/declared-large") {
        res.writeHead(200, { "content-length": "100" });
        res.end("x".repeat(100));
        return;
      }
      if (req.url === "/truncated") {
        res.writeHead(200, { "content-length": "50" });
        res.flushHeaders();
        res.write("partial-bytes", () => {
          setTimeout(() => {
            res.socket?.destroy();
          }, 15);
        });
        return;
      }
      if (req.url === "/chunked-large") {
        res.writeHead(200, { "transfer-encoding": "chunked" });
        res.write("12345");
        res.end("67890");
        return;
      }
      if (req.url === "/slow") {
        setTimeout(() => {
          res.writeHead(200);
          res.end("late");
        }, 250);
        return;
      }
      if (req.url === "/drip") {
        res.writeHead(200, { "content-type": "text/plain" });
        res.write("part-1");
        setTimeout(() => {
          res.end("part-2");
        }, 200);
        return;
      }
      if (req.url === "/gzip-ok") {
        const compressed = gzipSync(Buffer.from("decoded-gzip-payload"));
        res.writeHead(200, {
          "content-encoding": "gzip",
          "content-length": String(compressed.byteLength),
          "content-type": "text/plain",
        });
        res.end(compressed);
        return;
      }
      if (req.url === "/deflate-ok") {
        res.writeHead(200, {
          "content-encoding": "deflate",
          "content-type": "text/plain",
        });
        res.end(deflateSync(Buffer.from("decoded-deflate")));
        return;
      }
      if (req.url === "/br-ok") {
        res.writeHead(200, {
          "content-encoding": "br",
          "content-type": "text/plain",
        });
        res.end(brotliCompressSync(Buffer.from("decoded-br")));
        return;
      }
      if (req.url === "/identity-ok") {
        res.writeHead(200, {
          "content-encoding": "identity",
          "content-type": "text/plain",
        });
        res.end("identity-payload");
        return;
      }
      if (req.url === "/gzip-corrupt") {
        res.writeHead(200, {
          "content-encoding": "gzip",
          "content-type": "text/plain",
        });
        res.end("not-valid-gzip-bytes");
        return;
      }
      if (req.url === "/gzip-wire-flood") {
        // Valid GZIP header with FCOMMENT (0x10) followed by 2 KiB of non-null comment bytes (zero decoded output)
        const header = Buffer.from([
          0x1f, 0x8b, 0x08, 0x10, 0, 0, 0, 0, 0, 0x03,
        ]);
        res.writeHead(200, {
          "content-encoding": "gzip",
          "content-type": "text/plain",
        });
        res.end(Buffer.concat([header, Buffer.alloc(2048, 0x61)]));
        return;
      }
      if (req.url === "/unsupported-encoding") {
        res.writeHead(200, {
          "content-encoding": "zstd",
          "content-type": "text/plain",
        });
        res.end("compressed");
        return;
      }
      if (req.url === "/stacked-encoding") {
        res.writeHead(200, {
          "content-encoding": "gzip, br",
          "content-type": "text/plain",
        });
        res.end("compressed");
        return;
      }
      res.writeHead(200, {
        "content-type": "IMAGE/PNG; charset=utf-8",
        "x-seen-accept-encoding": req.headers["accept-encoding"] ?? "",
      });
      res.end("png-bytes");
    });
    const base = `http://127.0.0.1:${String(port)}`;
    const disabledSsrf = { enabled: false } as const;

    const viaAllowedHost = await fetchExternalFile(
      `http://media.corp.internal:${String(port)}/redirect`,
      {
        lookupFn: () => Promise.resolve([{ address: "127.0.0.1", family: 4 }]),
        ssrf: compileSsrfPolicy({ allowedHosts: ["*.corp.internal"] }),
      },
    );
    expect(viaAllowedHost.contentType).toBe("image/png");
    expect(viaAllowedHost.pathname).toBe("/files/avatar.png");
    await expect(readStream(viaAllowedHost.stream)).resolves.toBe("png-bytes");

    await expect(
      fetchExternalFile(`${base}/redirect-metadata`, {
        ssrf: { allowedHosts: ["127.0.0.1"] },
      }),
    ).rejects.toThrow("disallowed network address");

    // Malformed redirect Location must not leak secret query tokens in error message
    let caughtRedirectError: Error | undefined;
    try {
      await fetchExternalFile(`${base}/bad-location?token=super-secret-token`, {
        ssrf: disabledSsrf,
      });
    } catch (error) {
      caughtRedirectError = error as Error;
    }
    expect(caughtRedirectError).toBeInstanceOf(BadRequestException);
    expect(caughtRedirectError?.message).toBe("Invalid file source URL");
    expect(caughtRedirectError?.message).not.toContain("super-secret-token");

    // 206 Partial Content must be rejected
    await expect(
      fetchExternalFile(`${base}/partial`, { ssrf: disabledSsrf }),
    ).rejects.toThrow("HTTP 206");

    // Premature 101 Switching Protocols close settles with BadRequestException
    const upgradePort = await startRawUpgradeServer();
    await expect(
      fetchExternalFile(`http://127.0.0.1:${String(upgradePort)}/ws`, {
        ssrf: disabledSsrf,
      }),
    ).rejects.toThrow("Failed to fetch external file URL");

    await expect(
      fetchExternalFile(`${base}/no-location`, { ssrf: disabledSsrf }),
    ).rejects.toThrow("exceeded allowed redirects");
    await expect(
      fetchExternalFile(`${base}/loop`, { ssrf: disabledSsrf }),
    ).rejects.toThrow("exceeded allowed redirects");
    await expect(
      fetchExternalFile(`${base}/missing`, { ssrf: disabledSsrf }),
    ).rejects.toThrow("HTTP 404");
    await expect(
      fetchExternalFile(`${base}/declared-large`, {
        maxFileSize: 10,
        ssrf: disabledSsrf,
      }),
    ).rejects.toThrow("exceeds maximum size");
    const dynamicBounded = await fetchExternalFile(`${base}/files/avatar.png`, {
      resolveMaxFileSize: () => 4,
      ssrf: disabledSsrf,
    });
    await expect(readStream(dynamicBounded.stream)).rejects.toThrow(
      "exceeds maximum size",
    );
    await expect(
      fetchExternalFile(`${base}/files/avatar.png`, {
        resolveMaxFileSize: () => {
          throw new BadRequestException("Rejected by policy");
        },
        ssrf: disabledSsrf,
      }),
    ).rejects.toThrow("Rejected by policy");

    const chunked = await fetchExternalFile(`${base}/chunked-large`, {
      maxFileSize: 6,
      ssrf: disabledSsrf,
    });
    await expect(readStream(chunked.stream)).rejects.toThrow(
      "exceeds maximum size",
    );

    const truncated = await fetchExternalFile(`${base}/truncated`, {
      ssrf: disabledSsrf,
    });
    await expect(readStream(truncated.stream)).rejects.toThrow(
      "External file download aborted",
    );

    const midStreamAbort = new AbortController();
    const dripping = await fetchExternalFile(`${base}/drip`, {
      signal: midStreamAbort.signal,
      ssrf: disabledSsrf,
    });
    setTimeout(() => {
      midStreamAbort.abort();
    }, 20);
    await expect(readStream(dripping.stream)).rejects.toThrow(
      "External file download aborted",
    );

    // Body drip exceeding total deadline rejects with request timed out
    const bodyTimeout = await fetchExternalFile(`${base}/drip`, {
      ssrf: disabledSsrf,
      timeout: 35,
    });
    await expect(readStream(bodyTimeout.stream)).rejects.toThrow(
      "External file request timed out",
    );

    await expect(
      fetchExternalFile(`${base}/slow`, {
        ssrf: disabledSsrf,
        timeout: 30,
      }),
    ).rejects.toThrow("timed out");

    await expect(
      fetchExternalFile(`${base}/files/avatar.png`, {
        resolveMaxFileSize: () => Number.NaN,
        ssrf: disabledSsrf,
      }),
    ).rejects.toThrow("External file maxFileSize must be a positive integer");
    await expect(
      fetchExternalFile(`${base}/files/avatar.png`, {
        resolveMaxFileSize: () => Number.POSITIVE_INFINITY,
        ssrf: disabledSsrf,
      }),
    ).rejects.toThrow("External file maxFileSize must be a positive integer");

    // Transparent decompression and decoded-size enforcement
    const gzipFetched = await fetchExternalFile(`${base}/gzip-ok`, {
      maxFileSize: 20,
      ssrf: disabledSsrf,
    });
    await expect(readStream(gzipFetched.stream)).resolves.toBe(
      "decoded-gzip-payload",
    );
    const gzipTooLarge = await fetchExternalFile(`${base}/gzip-ok`, {
      maxFileSize: 10,
      ssrf: disabledSsrf,
    });
    await expect(readStream(gzipTooLarge.stream)).rejects.toThrow(
      "External file exceeds maximum size",
    );
    const deflateFetched = await fetchExternalFile(`${base}/deflate-ok`, {
      ssrf: disabledSsrf,
    });
    await expect(readStream(deflateFetched.stream)).resolves.toBe(
      "decoded-deflate",
    );
    const brFetched = await fetchExternalFile(`${base}/br-ok`, {
      ssrf: disabledSsrf,
    });
    await expect(readStream(brFetched.stream)).resolves.toBe("decoded-br");
    const identityFetched = await fetchExternalFile(`${base}/identity-ok`, {
      ssrf: disabledSsrf,
    });
    await expect(readStream(identityFetched.stream)).resolves.toBe(
      "identity-payload",
    );
    const corruptGzip = await fetchExternalFile(`${base}/gzip-corrupt`, {
      ssrf: disabledSsrf,
    });
    await expect(readStream(corruptGzip.stream)).rejects.toThrow(
      "Invalid external file content encoding",
    );
    const wireFlood = await fetchExternalFile(`${base}/gzip-wire-flood`, {
      maxFileSize: 16,
      ssrf: disabledSsrf,
    });
    await expect(readStream(wireFlood.stream)).rejects.toThrow(
      "External file exceeds maximum size",
    );
    const callbackAbort = new AbortController();
    const abortedDuringHeaderCallback = await fetchExternalFile(
      `${base}/gzip-ok`,
      {
        resolveMaxFileSize: () => {
          callbackAbort.abort();
          return 1024;
        },
        signal: callbackAbort.signal,
        ssrf: disabledSsrf,
      },
    );
    await expect(
      readStream(abortedDuringHeaderCallback.stream),
    ).rejects.toThrow("External file download aborted");
    await expect(
      fetchExternalFile(`${base}/unsupported-encoding`, { ssrf: disabledSsrf }),
    ).rejects.toThrow("Unsupported external file content encoding");
    await expect(
      fetchExternalFile(`${base}/stacked-encoding`, { ssrf: disabledSsrf }),
    ).rejects.toThrow("Unsupported external file content encoding");

    const preAborted = new AbortController();
    preAborted.abort();
    await expect(
      fetchExternalFile(`${base}/files/avatar.png`, {
        signal: preAborted.signal,
        ssrf: disabledSsrf,
      }),
    ).rejects.toThrow("Failed to fetch external file URL");
  });
});

/**
 * Reads all UTF-8 text from a stream.
 * @param stream - Readable stream to consume.
 * @returns Concatenated UTF-8 string.
 */
async function readStream(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Starts an ephemeral local HTTP test server.
 * @param registry - Server list cleaned up after each test.
 * @param handler - HTTP request handler.
 * @returns Bound TCP port on 127.0.0.1.
 */
async function startServer(
  registry: Server[],
  handler: RequestListener,
): Promise<number> {
  const server = createServer(handler);
  registry.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  return address.port;
}

/**
 * Starts a one-shot TCP server that replies with `101 Switching Protocols` and closes.
 * @returns Bound TCP port on 127.0.0.1.
 */
async function startRawUpgradeServer(): Promise<number> {
  const tcpServer = createTcpServer((socket) => {
    socket.once("data", () => {
      socket.end(
        "HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n",
      );
      tcpServer.close();
    });
  });
  await new Promise<void>((resolve) => {
    tcpServer.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });
  const address = tcpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  return address.port;
}
