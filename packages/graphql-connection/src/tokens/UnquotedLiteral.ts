import { createToken } from "chevrotain";

import { Value } from "./values";

export const UnquotedLiteral = createToken({
  name: "UnquotedLiteral",
  pattern: /[^\s:(),]+/,
  categories: [Value],
});
