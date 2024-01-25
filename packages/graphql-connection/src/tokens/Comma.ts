import { createToken } from "chevrotain";

export const Comma = createToken({
  name: "Comma",
  pattern: /,/,
});
