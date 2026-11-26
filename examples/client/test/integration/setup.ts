import { afterEach } from "vitest";
import { cleanup } from "vitest-browser-react";
import "@/styles.css";

afterEach(async () => {
  await cleanup();
});
