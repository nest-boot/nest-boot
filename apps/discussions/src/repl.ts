import { repl } from "@nestjs/core";

import { AppModule } from "./app.module";

void (async () => {
  const replServer = await repl(AppModule);

  replServer.setupHistory(".nestjs_repl_history", (err) => {
    if (err !== null) {
      console.error(err);
    }
  });
})();
