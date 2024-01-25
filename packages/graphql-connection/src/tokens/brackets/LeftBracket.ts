import { createToken } from "chevrotain";

export const LeftBracket = createToken({
  name: "LeftBracket",
  pattern: /\(/,
});
