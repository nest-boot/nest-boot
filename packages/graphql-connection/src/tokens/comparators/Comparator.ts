import { createToken, Lexer } from "chevrotain";

export const Comparator = createToken({
  name: "Comparator",
  pattern: Lexer.NA,
});
