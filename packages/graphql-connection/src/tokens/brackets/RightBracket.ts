import { createToken } from "chevrotain";

export const RightBracket = createToken({
  name: "RightBracket",
  pattern: /\)/,
});
