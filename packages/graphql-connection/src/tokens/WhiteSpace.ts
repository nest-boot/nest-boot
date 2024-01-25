import { createToken, Lexer } from "chevrotain";

import { QuotedString } from "./values/QuotedString";

export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED,
  longer_alt: QuotedString,
});
