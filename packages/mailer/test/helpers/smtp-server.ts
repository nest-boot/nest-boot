import { once } from "node:events";
import { type AddressInfo, createServer, type Socket } from "node:net";
import { createInterface } from "node:readline";

/**
 * Starts a local SMTP server with controllable authentication and greeting delays.
 * @returns Server address, observed commands, fault controls, and cleanup.
 */
export async function createSmtpServer() {
  const sockets = new Set<Socket>();
  const greetings = new Set<() => void>();
  const commands: string[] = [];
  const state = { authenticate: true, stalled: false, connections: 0 };
  const server = createServer((socket) => {
    state.connections++;
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => socket.destroy());
    socket.write("220 localhost ESMTP\r\n");
    createInterface({ input: socket, crlfDelay: Infinity }).on(
      "line",
      (line: string) => {
        // Keep command names only; AUTH payloads are not needed by the tests.
        const command = line.split(" ")[0];
        commands.push(command);
        if (command === "EHLO" || command === "HELO") {
          const greet = () => {
            if (!socket.destroyed)
              socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
          };
          if (state.stalled) greetings.add(greet);
          else greet();
        } else if (command === "AUTH") {
          socket.write(
            state.authenticate
              ? "235 Authentication successful\r\n"
              : "535 Authentication failed\r\n",
          );
        } else if (command === "QUIT") {
          socket.end("221 Bye\r\n");
        } else {
          socket.write("550 Message submission disabled\r\n");
        }
      },
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  return {
    port: (server.address() as AddressInfo).port,
    sockets,
    commands,
    state,
    resume: () => {
      state.stalled = false;
      for (const greet of greetings) greet();
      greetings.clear();
    },
    close: async () => {
      for (const socket of sockets) socket.destroy();
      greetings.clear();
      if (!server.listening) return;
      const closed = once(server, "close");
      server.close();
      await closed;
    },
  };
}
