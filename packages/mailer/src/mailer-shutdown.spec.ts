import { once } from "node:events";
import { type AddressInfo, createServer, type Socket } from "node:net";
import { createInterface } from "node:readline";

import { Test, type TestingModule } from "@nestjs/testing";
import Mailer from "nodemailer/lib/mailer/index.js";

import { MailerModule } from "./mailer.module.js";

describe("Mailer shutdown", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["direct", "sync", "async"] as const)(
    "closes pooled SMTP connections with %s registration",
    async (registration) => {
      const smtp = await createSmtpServer();
      let module: TestingModule | undefined;
      let mailer: Mailer | undefined;

      try {
        const options = {
          url: `smtp://127.0.0.1:${String(smtp.port)}?pool=true`,
        };
        vi.stubEnv("SMTP_URL", options.url);
        module = await Test.createTestingModule({
          imports: [
            registration === "direct"
              ? MailerModule
              : registration === "sync"
                ? MailerModule.register(options)
                : MailerModule.registerAsync({ useFactory: () => options }),
          ],
        }).compile();
        mailer = module.get<Mailer>(Mailer);
        await module.init();
        await mailer.sendMail({
          from: "sender@example.com",
          to: "recipient@example.com",
          subject: "Shutdown regression",
          text: "Keep the SMTP connection pooled until Nest shuts down.",
        });
        expect(smtp.sockets.size).toBe(1);

        await module.close();
        module = undefined;

        await expect.poll(() => smtp.sockets.size).toBe(0);
      } finally {
        // Release resources even when the shutdown assertion fails.
        mailer?.close();
        await smtp.close();
        await module?.close();
      }
    },
  );
});

/**
 * Starts a minimal SMTP server to observe real pooled TCP connections.
 * @returns Local server address, live sockets, and cleanup function.
 */
async function createSmtpServer() {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 localhost ESMTP\r\n");
    let receivingData = false;

    createInterface({ input: socket, crlfDelay: Infinity }).on(
      "line",
      (line: string) => {
        if (receivingData) {
          if (line === ".") {
            receivingData = false;
            socket.write("250 Accepted\r\n");
          }
        } else if (line === "DATA") {
          receivingData = true;
          socket.write("354 Send message\r\n");
        } else if (line === "QUIT") {
          socket.end("221 Bye\r\n");
        } else {
          socket.write("250 OK\r\n");
        }
      },
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  return {
    port: (server.address() as AddressInfo).port,
    sockets,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      const closed = once(server, "close");
      server.close();
      await closed;
    },
  };
}
